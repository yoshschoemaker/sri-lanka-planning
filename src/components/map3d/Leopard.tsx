import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import { useAppearanceCycle } from "../../utils/useAppearanceCycle";
import { createWalkPath, walkEase } from "../../utils/walkPath3d";
import { getTerrainSurfaceY } from "./Highlands";

const COAT_COLOR = "#c9903f";
const SPOT_COLOR = "#5c3a1e";
/** Body-primitive dimensions below are tuned at 1x; this blows the whole critter up so it actually reads at diorama viewing distance. */
const SCALE = 2.6;

/** Front pair at +z (the head end), rear pair at -z. */
const LEG_OFFSETS: [number, number][] = [
  [-0.018, -0.032],
  [0.018, -0.032],
  [-0.018, 0.026],
  [0.018, 0.026],
];
/** Diagonal pairs together, same as Elephant — a cat's walk is just a faster version of it. */
const LEG_PHASE = [0, Math.PI, Math.PI, 0];

const SPOT_OFFSETS: [number, number, number][] = [
  [0.018, 0.038, 0.03],
  [-0.014, 0.04, 0.005],
  [0.012, 0.036, -0.02],
  [-0.016, 0.035, -0.04],
];

/** Seconds the stretch-and-flick reaction plays before settling back to rest. */
const REACTION_DURATION = 1.4;

const TAIL_REST_X = -0.7;

/**
 * A leopard sighting is a matter of seconds, and long minutes of nothing in
 * between — hence the short window and the long, wide gap.
 */
const VISIBLE_FOR = 8;
const MIN_GAP = 35;
const MAX_GAP = 85;
/** World units the prowl aims to cover. Shorter than the elephant's stroll but walked in a third of the time, so it reads as much quicker. */
const WALK_LENGTH = 0.55;
/** Radians of leg swing per world unit travelled — sets the stride length, so the paws never skate. */
const CADENCE = 95;

/**
 * Low-poly leopard, a nod to Wilpattu's sightings, and deliberately hard to
 * catch: it is off-stage most of the time, slinks into view for a handful of
 * seconds on a freshly picked route, freezes mid-prowl to look around, then
 * melts back into the scrub (useAppearanceCycle + createWalkPath). Body sits
 * low and long (crouching stance) rather than upright, which reads better as
 * "cat" than a sphere-with-legs would at this scale. The tail curls and the ribs
 * breathe throughout, and now and then it flicks the tail on its own
 * (useIdleMotion). Clicking it while it *is* there plays a one-shot stretch +
 * tail flick, the same "wake up the diorama" easter egg Elephant/Whale/Turtle
 * each have their own version of.
 *
 * Under prefers-reduced-motion it simply sits at its home position, permanently
 * visible and entirely still.
 */
export function Leopard({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const legRefs = useRef<(THREE.Group | null)[]>([]);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 1, minGap: 3.5, maxGap: 9, duration: 1.5 });
  const { visible, cycleId, sample } = useAppearanceCycle({
    visibleFor: VISIBLE_FOR,
    minGap: MIN_GAP,
    maxGap: MAX_GAP,
    fade: 1.1,
    firstDelay: 14,
    enabled: !prefersReducedMotion,
    restProgress: 0.5,
  });

  // cycleId is the re-roll key: a new prowl route for every sighting.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const path = useMemo(() => createWalkPath({ x, z }, WALK_LENGTH), [x, z, cycleId]);
  const walkPhase = useRef(0);
  const prevPathT = useRef<number | null>(null);

  // Two shared materials (coat, spots) so fading the whole animal is two
  // opacity writes. The component stays mounted between appearances, so these
  // live as long as the map and need no manual disposal.
  const [coatMaterial, spotMaterial] = useMemo(
    () =>
      [COAT_COLOR, SPOT_COLOR].map(
        (color) =>
          new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, transparent: true }),
      ),
    [],
  );

  useFrame(({ clock }, delta) => {
    if (prefersReducedMotion) return;
    const { t, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime);
    const e = envelope();
    const { fade, progress } = sample();

    coatMaterial.opacity = fade;
    spotMaterial.opacity = fade;

    const pathT = walkEase(progress, 0.45, 0.68);
    const step = prevPathT.current === null ? 0 : pathT - prevPathT.current;
    prevPathT.current = pathT;
    const speed = delta > 0 ? (step * path.length) / delta : 0;
    // Same normalisation as Elephant: gait is measured against this route's own
    // top speed, not an absolute one, so a cramped route still prowls.
    const gait = Math.min(1, Math.max(0, speed / ((path.length / VISIBLE_FOR) * 1.5)));
    walkPhase.current += step * path.length * CADENCE;
    const w = walkPhase.current;

    for (let i = 0; i < legRefs.current.length; i++) {
      const leg = legRefs.current[i];
      if (!leg) continue;
      leg.rotation.x = Math.sin(w + LEG_PHASE[i]) * 0.5 * gait;
    }

    if (tailRef.current) {
      tailRef.current.rotation.z =
        Math.sin(t * 0.9) * 0.3 +
        Math.sin(t * 0.33) * 0.09 +
        Math.sin(fidgetElapsed * 11) * 0.3 * fidget +
        (e ? Math.sin(e.elapsed * 14) * 0.5 * e.strength : 0);
      // Tail counterbalances the stride while prowling, and hangs low when still.
      tailRef.current.rotation.x = TAIL_REST_X + Math.sin(t * 0.6) * 0.16 + Math.sin(w * 0.5) * 0.2 * gait;
    }

    if (bodyRef.current) {
      // Ribs on the breath curve, plus the stretch a click or a fidget adds on top.
      bodyRef.current.scale.set(
        0.8 + breath * 0.035,
        0.7 + breath * 0.05,
        1.6 + breath * 0.03 + Math.sin(fidgetElapsed * 4) * 0.06 * fidget + (e ? Math.sin(e.elapsed * 6) * 0.18 * e.strength : 0),
      );
      bodyRef.current.position.y = 0.024 + breath * 0.0015;
    }

    if (headRef.current) {
      // Slow scan of the horizon on top of the breath, so it never looks frozen between fidgets.
      headRef.current.rotation.y =
        Math.sin(t * 0.45) * 0.14 + Math.sin(t * 0.17) * 0.1 + Math.sin(fidgetElapsed * 2.4) * 0.38 * fidget;
      headRef.current.rotation.x = Math.sin(t * 0.8 - 0.5) * 0.07 - 0.06 * fidget;
    }

    if (groupRef.current) {
      const p = path.pointAt(pathT);
      groupRef.current.position.set(p.x, getTerrainSurfaceY(p.x, p.z), p.z);
      groupRef.current.rotation.y = path.headingAt(pathT) + Math.sin(t * 0.31) * 0.05;
      // Shoulders roll on the stride; a stalking cat's whole back moves.
      groupRef.current.rotation.z = Math.sin(w) * 0.045 * gait;
      // Crouches on arrival and departure, so it reads as low in the grass rather than dissolving in mid-air.
      groupRef.current.scale.setScalar(SCALE * (0.82 + 0.18 * fade));
    }
  });

  if (!visible) return null;

  return (
    <group
      ref={groupRef}
      position={[x, getTerrainSurfaceY(x, z), z]}
      rotation={[0, -0.4, 0]}
      scale={SCALE}
      onClick={(e) => {
        e.stopPropagation();
        trigger();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh ref={bodyRef} position={[0, 0.024, 0]} scale={[0.8, 0.7, 1.6]} material={coatMaterial}>
        <sphereGeometry args={[0.035, 8, 6]} />
      </mesh>

      {/* Head and ears share a pivot at the neck so a look-around carries both. */}
      <group ref={headRef} position={[0, 0.03, 0.062]}>
        <mesh scale={[0.75, 0.75, 0.75]} material={coatMaterial}>
          <sphereGeometry args={[0.026, 7, 6]} />
        </mesh>

        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.014, 0.02, 0.006]} material={coatMaterial}>
            <coneGeometry args={[0.008, 0.014, 4]} />
          </mesh>
        ))}
      </group>

      <mesh ref={tailRef} position={[0, 0.04, -0.07]} rotation={[TAIL_REST_X, 0, 0]} material={coatMaterial}>
        <cylinderGeometry args={[0.005, 0.003, 0.06, 5]} />
      </mesh>

      {/* Legs hang from hip pivots so a swing rotates the whole leg from the top. */}
      {LEG_OFFSETS.map(([dx, dz], i) => (
        <group
          key={i}
          ref={(g) => {
            legRefs.current[i] = g;
          }}
          position={[dx, 0.016, dz]}
        >
          <mesh position={[0, -0.008, 0]} material={coatMaterial}>
            <cylinderGeometry args={[0.007, 0.007, 0.016, 5]} />
          </mesh>
        </group>
      ))}

      {SPOT_OFFSETS.map(([dx, dy, dz], i) => (
        <mesh key={i} position={[dx, dy, dz]} material={spotMaterial}>
          <sphereGeometry args={[0.006, 5, 4]} />
        </mesh>
      ))}

      {reacting && (
        <Html position={[0, 0.09, 0.02]} center zIndexRange={CRITTER_HTML_Z}>
          <div className="marker-label-glass pointer-events-none whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream">
            Sst, sluipmodus 🐆
          </div>
        </Html>
      )}
    </group>
  );
}
