import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import { useAppearanceCycle } from "../../utils/useAppearanceCycle";
import { createWalkPath, walkEase } from "../../utils/walkPath3d";
import { getTerrainSurfaceY } from "./Highlands";

const BODY_COLOR = "#96908a";
const BODY_COLOR_DARK = "#5c5650";
/** Body-primitive dimensions below are tuned at 1x; this blows the whole critter up so it actually reads at diorama viewing distance. */
const SCALE = 2.6;
/** The calf, as a fraction of its mother. Small enough to read as a baby at a glance, big enough not to look like a boulder. */
const CALF_SCALE = 0.55;

/** Front pair at +z (the head end), rear pair at -z. */
const LEG_OFFSETS: [number, number][] = [
  [-0.025, -0.038],
  [0.025, -0.038],
  [-0.025, 0.03],
  [0.025, 0.03],
];
/** Diagonal pairs move together, the way a real four-legged walk does. */
const LEG_PHASE = [0, Math.PI, Math.PI, 0];

/** Seconds the ear-flap + trunk-raise reaction plays before settling back to rest. */
const REACTION_DURATION = 1.6;

const BASE_TURN = 1.3;
const TRUNK_REST_X = 0.55;
const EAR_REST_Z = 0.6;

/** Seconds one appearance lasts, and the range of seconds the herd is gone for in between. */
const VISIBLE_FOR = 22;
const MIN_GAP = 22;
const MAX_GAP = 50;
/** World units the whole stroll aims to cover; createWalkPath shortens it where the terrain demands. */
const WALK_LENGTH = 1;
/** Radians of leg swing per world unit travelled — sets the stride length, so the feet never skate. */
const CADENCE = 62;

/** Where the calf walks, in world units: this far behind its mother and this far off to her flank. */
const CALF_BEHIND = 0.17;
const CALF_ASIDE = 0.11;

/** Every animated part of one elephant, so a single frame loop can drive both mother and calf. */
interface ElephantRefs {
  group: RefObject<THREE.Group | null>;
  body: RefObject<THREE.Mesh | null>;
  head: RefObject<THREE.Group | null>;
  trunk: RefObject<THREE.Mesh | null>;
  tail: RefObject<THREE.Mesh | null>;
  ears: RefObject<(THREE.Mesh | null)[]>;
  legs: RefObject<(THREE.Group | null)[]>;
}

function useElephantRefs(): ElephantRefs {
  return {
    group: useRef<THREE.Group>(null),
    body: useRef<THREE.Mesh>(null),
    head: useRef<THREE.Group>(null),
    trunk: useRef<THREE.Mesh>(null),
    tail: useRef<THREE.Mesh>(null),
    ears: useRef<(THREE.Mesh | null)[]>([]),
    legs: useRef<(THREE.Group | null)[]>([]),
  };
}

/**
 * The body itself, once. Extracted so the herd is two of these sharing one walk
 * path, one pair of materials and one frame loop, rather than two components
 * each rolling their own route and wandering apart.
 */
function ElephantBody({
  refs,
  bodyMaterial,
  darkMaterial,
  onActivate,
  position,
  rotationY,
  scale,
  children,
}: {
  refs: ElephantRefs;
  bodyMaterial: THREE.Material;
  darkMaterial: THREE.Material;
  onActivate: () => void;
  /** Where it stands before the frame loop takes over, and where it stays under reduced motion. */
  position: [number, number, number];
  rotationY: number;
  scale: number;
  children?: React.ReactNode;
}) {
  return (
    <group
      ref={refs.group}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh ref={refs.body} position={[0, 0.042, 0]} scale={[1, 0.85, 1.4]} material={bodyMaterial}>
        <sphereGeometry args={[0.045, 8, 6]} />
      </mesh>

      {/* Head, ears and trunk share a pivot at the neck so a nod carries all three. */}
      <group ref={refs.head} position={[0, 0.05, 0.065]}>
        <mesh scale={[0.85, 0.85, 0.85]} material={bodyMaterial}>
          <sphereGeometry args={[0.032, 7, 6]} />
        </mesh>

        {[-1, 1].map((side, i) => (
          <mesh
            key={side}
            ref={(m) => {
              refs.ears.current[i] = m;
            }}
            position={[side * 0.038, 0.008, -0.01]}
            rotation={[0, 0, side * EAR_REST_Z]}
            scale={[0.85, 1.2, 0.18]}
            material={darkMaterial}
          >
            <sphereGeometry args={[0.026, 6, 5]} />
          </mesh>
        ))}

        <mesh ref={refs.trunk} position={[0, -0.025, 0.025]} rotation={[TRUNK_REST_X, 0, 0]} material={bodyMaterial}>
          <coneGeometry args={[0.009, 0.05, 5]} />
        </mesh>
      </group>

      {/* Each leg hangs from a hip pivot, so a swing rotates the whole leg from the top rather than scissoring around its middle. */}
      {LEG_OFFSETS.map(([dx, dz], i) => (
        <group
          key={i}
          ref={(g) => {
            refs.legs.current[i] = g;
          }}
          position={[dx, 0.024, dz]}
        >
          <mesh position={[0, -0.012, 0]} material={darkMaterial}>
            <cylinderGeometry args={[0.011, 0.011, 0.024, 5]} />
          </mesh>
        </group>
      ))}

      <mesh ref={refs.tail} position={[0, 0.04, -0.068]} rotation={[0.4, 0, 0]} material={darkMaterial}>
        <cylinderGeometry args={[0.004, 0.003, 0.03, 4]} />
      </mesh>

      {children}
    </group>
  );
}

/** Everything one elephant's parts need per frame, shared by mother and calf. */
interface PoseInput {
  /** Per-instance idle time. */
  t: number;
  breath: number;
  fidget: number;
  fidgetElapsed: number;
  /** Leg-swing phase in radians. */
  w: number;
  /** 0 standing still, 1 walking at this route's top speed. */
  gait: number;
  /** Reaction strength from a click, or null. */
  reaction: { elapsed: number; strength: number } | null;
}

/** Poses one elephant's ears, trunk, flanks, head, tail and legs. Position/heading of the group is the caller's job. */
function poseElephant(refs: ElephantRefs, { t, breath, fidget, fidgetElapsed, w, gait, reaction: e }: PoseInput) {
  for (let i = 0; i < refs.legs.current.length; i++) {
    const leg = refs.legs.current[i];
    if (!leg) continue;
    leg.rotation.x = Math.sin(w + LEG_PHASE[i]) * 0.34 * gait;
  }

  for (let i = 0; i < refs.ears.current.length; i++) {
    const ear = refs.ears.current[i];
    if (!ear) continue;
    const side = i === 0 ? -1 : 1;
    const flap =
      Math.sin(t * 1.1 + i) * 0.12 +
      Math.sin(t * 0.37 + i * 1.7) * 0.05 +
      // Ears swing on the stride as well; walking elephants flap far more than standing ones.
      Math.sin(w + i * 0.6) * 0.14 * gait +
      Math.sin(fidgetElapsed * 7) * 0.22 * fidget +
      (e ? Math.sin(e.elapsed * 9) * 0.35 * e.strength : 0);
    ear.rotation.z = side * (EAR_REST_Z + flap);
  }

  if (refs.trunk.current) {
    refs.trunk.current.rotation.x =
      TRUNK_REST_X + Math.sin(t * 0.9) * 0.18 - 0.28 * fidget - (e ? 0.5 * e.strength : 0);
    refs.trunk.current.rotation.z =
      Math.sin(t * 0.55) * 0.26 + Math.sin(w * 0.5) * 0.2 * gait + Math.sin(fidgetElapsed * 4) * 0.1 * fidget;
  }

  // Flanks rise and fall; scale rather than position so the feet stay planted.
  if (refs.body.current) {
    refs.body.current.scale.set(1 + breath * 0.05, 0.85 + breath * 0.04, 1.4 + breath * 0.03);
    refs.body.current.position.y = 0.042 + breath * 0.002;
  }
  if (refs.head.current) {
    // Head follows the breath a beat later, so the nod reads as one body instead of two parts.
    refs.head.current.rotation.x = Math.sin(t * 0.7 - 0.6) * 0.09 - 0.08 * fidget + Math.sin(w * 2) * 0.04 * gait;
    refs.head.current.rotation.y = Math.sin(t * 0.31) * 0.07 + Math.sin(fidgetElapsed * 2.4) * 0.12 * fidget;
  }
  if (refs.tail.current) {
    refs.tail.current.rotation.z = Math.sin(t * 1.3) * 0.26 + Math.sin(fidgetElapsed * 8) * 0.35 * fidget;
  }
}

/**
 * Low-poly elephants, a nod to Yala's herds, that actually go somewhere: a cow
 * and her calf fade in, stroll a short curved path across their patch of park
 * (legs swinging, bodies rolling on the stride), stand still for a beat halfway
 * to graze, walk on, and fade out again for half a minute or so before coming
 * back on a freshly picked route (useAppearanceCycle + createWalkPath). The calf
 * walks the same route a body-length behind and off to one flank, at a quicker
 * step because its legs are shorter — the pair being out of step with each other
 * is most of what makes them read as two animals rather than one model twice.
 *
 * Ears and trunk are the two features that keep a silhouette this small readable
 * as "elephant" rather than "grey blob", so both keep moving throughout: the
 * trunk sways, the flanks breathe, and every so often they shake their ears on
 * their own (useIdleMotion). Clicking either one plays a louder one-shot ear flap
 * + trunk raise on both, the same "wake up the diorama" easter egg
 * Leopard/Whale/Turtle each have their own version of.
 *
 * Under prefers-reduced-motion they simply stand at the home position: no
 * cycling, no walk, nothing moving at all.
 */
export function Elephant({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const cow = useElephantRefs();
  const calf = useElephantRefs();
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 0.8, minGap: 4, maxGap: 10, duration: 1.8 });
  const calfIdle = useIdleMotion({ speed: 1.15, minGap: 3, maxGap: 8, duration: 1.4 });
  const { visible, cycleId, sample } = useAppearanceCycle({
    visibleFor: VISIBLE_FOR,
    minGap: MIN_GAP,
    maxGap: MAX_GAP,
    fade: 1.4,
    firstDelay: 4,
    enabled: !prefersReducedMotion,
    restProgress: 0.5,
  });

  // A fresh route per appearance, so it is never the same walk twice. cycleId is
  // the point of the dependency list here, not an accident: it is the re-roll key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const path = useMemo(() => createWalkPath({ x, z }, WALK_LENGTH), [x, z, cycleId]);
  const walkPhase = useRef(0);
  const prevPathT = useRef<number | null>(null);

  // One material per colour, shared by every mesh of both animals, so the fade
  // in/out is a single opacity write instead of two dozen. The component itself
  // never unmounts (only its meshes do, between appearances), so these live as
  // long as the map does and need no manual disposal.
  const [bodyMaterial, darkMaterial] = useMemo(
    () =>
      [BODY_COLOR, BODY_COLOR_DARK].map(
        (color) =>
          new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, transparent: true }),
      ),
    [],
  );

  useFrame(({ clock }, delta) => {
    if (prefersReducedMotion) return;
    const { t, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime);
    const calfMotion = calfIdle(clock.elapsedTime);
    const e = envelope();
    const { fade, progress } = sample();

    bodyMaterial.opacity = fade;
    darkMaterial.opacity = fade;

    // Where along the route they are, and how fast they're going right now
    // (which is zero during the mid-walk pause, so the legs stop with them).
    const pathT = walkEase(progress);
    const step = prevPathT.current === null ? 0 : pathT - prevPathT.current;
    prevPathT.current = pathT;
    const speed = delta > 0 ? (step * path.length) / delta : 0;
    // Full-amplitude legs at the walk's own top speed (1.5x its average, the
    // peak of walkEase's smoothstep), so a route the terrain forced to be short
    // still gets a proper stride instead of a tiptoe.
    const gait = Math.min(1, Math.max(0, speed / ((path.length / VISIBLE_FOR) * 1.5)));
    walkPhase.current += step * path.length * CADENCE;
    const w = walkPhase.current;

    poseElephant(cow, { t, breath, fidget, fidgetElapsed, w, gait, reaction: e });
    // Shorter legs cover the same ground in more steps, and its own idle curve
    // keeps the calf from breathing in lockstep with its mother.
    poseElephant(calf, {
      t: calfMotion.t,
      breath: calfMotion.breath,
      fidget: calfMotion.fidget,
      fidgetElapsed: calfMotion.fidgetElapsed,
      w: w / CALF_SCALE,
      gait,
      reaction: e,
    });

    const p = path.pointAt(pathT);
    const heading = path.headingAt(pathT);
    const bob = Math.abs(Math.sin(w)) * 0.004 * gait;
    const wobble = Math.sin(t * 0.23) * 0.05 + Math.sin(fidgetElapsed * 2.2) * 0.1 * fidget;

    if (cow.group.current) {
      // Sampled per frame rather than once: the route can cross a beach/inland
      // boundary even while staying on one tier.
      cow.group.current.position.set(p.x, getTerrainSurfaceY(p.x, p.z) + bob, p.z);
      cow.group.current.rotation.y = heading + wobble;
      // Weight shifting from side to side, the giveaway of a heavy animal walking.
      cow.group.current.rotation.z = Math.sin(t * 0.41) * 0.012 + Math.sin(w) * 0.035 * gait;
      cow.group.current.scale.setScalar(SCALE * (0.9 + 0.1 * fade));
    }

    if (calf.group.current) {
      // Trails its mother in her own frame of reference: forward is where she's
      // pointed, so the calf keeps its place on her flank through every curve.
      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);
      const cx = p.x - forwardX * CALF_BEHIND + forwardZ * CALF_ASIDE;
      const cz = p.z - forwardZ * CALF_BEHIND - forwardX * CALF_ASIDE;
      const calfBob = Math.abs(Math.sin(w / CALF_SCALE)) * 0.004 * gait;
      calf.group.current.position.set(cx, getTerrainSurfaceY(cx, cz) + calfBob, cz);
      // Looks slightly towards its mother, and lags her turns a beat.
      calf.group.current.rotation.y = heading + wobble * 1.4 - 0.12;
      calf.group.current.rotation.z = Math.sin(w / CALF_SCALE) * 0.05 * gait;
      calf.group.current.scale.setScalar(SCALE * CALF_SCALE * (0.9 + 0.1 * fade));
    }
  });

  if (!visible) return null;

  // Where the pair stands before the first frame, and where they stay for good
  // under reduced motion (the loop above returns immediately in that case).
  const calfX = x - Math.sin(BASE_TURN) * CALF_BEHIND + Math.cos(BASE_TURN) * CALF_ASIDE;
  const calfZ = z - Math.cos(BASE_TURN) * CALF_BEHIND - Math.sin(BASE_TURN) * CALF_ASIDE;

  return (
    <>
      <ElephantBody
        refs={cow}
        bodyMaterial={bodyMaterial}
        darkMaterial={darkMaterial}
        onActivate={trigger}
        position={[x, getTerrainSurfaceY(x, z), z]}
        rotationY={BASE_TURN}
        scale={SCALE}
      >
        {reacting && (
          <Html position={[0, 0.1, 0.05]} center zIndexRange={CRITTER_HTML_Z}>
            <div className="marker-label-glass pointer-events-none whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream">
              Toet toet! 🐘
            </div>
          </Html>
        )}
      </ElephantBody>
      <ElephantBody
        refs={calf}
        bodyMaterial={bodyMaterial}
        darkMaterial={darkMaterial}
        onActivate={trigger}
        position={[calfX, getTerrainSurfaceY(calfX, calfZ), calfZ]}
        rotationY={BASE_TURN - 0.12}
        scale={SCALE * CALF_SCALE}
      />
    </>
  );
}
