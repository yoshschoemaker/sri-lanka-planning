import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import { getTerrainSurfaceY } from "./Highlands";

/** Indian peafowl: the neck is the loudest blue on the island, which is the point of putting one here. */
const BODY_COLOR = "#1f6f8b";
const NECK_COLOR = "#1d5fa8";
const FAN_COLOR = "#2fa383";
const FAN_EDGE_COLOR = "#c9a234";
const EYE_COLOR = "#2f4bb5";
const LEG_COLOR = "#8a7f6a";

/**
 * Body primitives below are authored at 1x; this blows the whole bird up so it
 * reads at diorama viewing distance. Higher than the ground mammals' 2.6 even
 * though a peacock is far smaller than an elephant: at 2.2 it was a blue lump
 * next to the stupa, and the fan — the entire reason for the bird — was
 * unreadable.
 */
const SCALE = 3.2;

/** Seconds the full display lasts after a click. Long: the whole point is to stand there with the fan up. */
const REACTION_DURATION = 3.2;

/** How wide the closed train sits, as a fraction of the open fan. Not near-zero — a folded train is still a long train dragging behind the bird, and it's what makes the closed silhouette read as a peacock at all. */
const FAN_CLOSED = 0.3;
/** How far the fan opens on its own during an idle fidget, as a fraction of the full display. */
const FAN_IDLE_PEAK = 0.45;
/** Seconds the fan takes to swing open or shut, as a rate towards its target. */
const FAN_LAMBDA = 4;
/** Fan tilt (radians about x) folded and fully open. See the frame loop for why open isn't vertical. */
const FAN_TILT_CLOSED = -1.15;
const FAN_TILT_OPEN = -0.6;

/** Eye spots on the fan: angle from the fan's centre line and distance out along it. */
const EYE_SPOTS: [number, number][] = [
  [-0.62, 0.062],
  [-0.32, 0.072],
  [0, 0.076],
  [0.32, 0.072],
  [0.62, 0.062],
  [-0.46, 0.04],
  [0.46, 0.04],
];

/**
 * A peacock in the dry-zone scrub around Anuradhapura, where wild peafowl
 * genuinely are everywhere. It pecks the ground, steps on the spot and swings
 * its neck around continuously, and now and then half-raises its train on its
 * own (useIdleMotion) — that half-raise is the hint that the bird does something
 * if you touch it.
 *
 * Clicking it puts the full display up: the fan swings open over three seconds,
 * shivers the way a displaying peacock's does, and folds back down. The fan is
 * one circle sector plus seven eye spots, opened by scaling it about its base
 * rather than by rebuilding geometry, so the display costs nothing per frame.
 *
 * Under prefers-reduced-motion it stands still with the train folded, and the
 * click still opens the fan (that is a response to a deliberate action, not
 * ambient motion) — just without the shiver.
 */
export function Peacock({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const neckRef = useRef<THREE.Group>(null);
  const fanRef = useRef<THREE.Group>(null);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 1.1, minGap: 7, maxGap: 16, duration: 2.4 });
  /** Current fan opening, eased towards its target so it never snaps. */
  const fan = useRef(FAN_CLOSED);

  useFrame(({ clock }, delta) => {
    const e = envelope();
    const { t, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime, !prefersReducedMotion);

    // A click wins over an idle half-raise, and both decay back to the folded train.
    const target = e ? 1 : FAN_CLOSED + FAN_IDLE_PEAK * fidget;
    fan.current += (target - fan.current) * Math.min(1, delta * FAN_LAMBDA);

    if (fanRef.current) {
      const shiver = e && !prefersReducedMotion ? Math.sin(e.elapsed * 22) * 0.03 * e.strength : 0;
      fanRef.current.scale.set(fan.current + shiver, fan.current, 1);
      // A folded train lies back along the ground; a full display tips up until
      // its face is square to the camera's own 35-degree downward view, which is
      // the angle at which the fan actually reads as a fan rather than as a
      // sliver. Dead-vertical looks wrong here for exactly that reason.
      fanRef.current.rotation.x = FAN_TILT_CLOSED + fan.current * (FAN_TILT_OPEN - FAN_TILT_CLOSED);
    }

    if (neckRef.current) {
      // Pecking: the neck dips on the breath curve and dips much deeper mid-fidget.
      const peck = prefersReducedMotion ? 0 : Math.max(0, Math.sin(t * 0.9)) ** 3;
      neckRef.current.rotation.x = peck * 0.85 + (prefersReducedMotion ? 0 : Math.sin(fidgetElapsed * 3) * 0.1 * fidget);
      // Head up and proud while displaying.
      if (e) neckRef.current.rotation.x = -0.25 * e.strength;
      neckRef.current.rotation.y = prefersReducedMotion ? 0 : Math.sin(t * 0.42) * 0.35 + Math.sin(t * 0.17) * 0.2;
    }

    if (bodyRef.current && !prefersReducedMotion) {
      bodyRef.current.scale.set(1 + breath * 0.03, 0.85 + breath * 0.03, 1.25);
    }

    if (groupRef.current && !prefersReducedMotion) {
      // Shifts its weight from foot to foot, and turns to show the fan off.
      groupRef.current.position.y = getTerrainSurfaceY(x, z) + Math.abs(Math.sin(t * 1.6)) * 0.004;
      groupRef.current.rotation.z = Math.sin(t * 1.6) * 0.02;
      groupRef.current.rotation.y =
        Math.sin(t * 0.23) * 0.25 + (e ? Math.sin(e.elapsed * 1.6) * 0.5 * e.strength : 0);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[x, getTerrainSurfaceY(x, z), z]}
      scale={SCALE}
      onClick={(evt) => {
        evt.stopPropagation();
        trigger();
      }}
      onPointerOver={(evt) => {
        evt.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* The fan, hinged at the tail so opening it scales about its own base. */}
      <group ref={fanRef} position={[0, 0.026, -0.03]} rotation={[FAN_TILT_CLOSED, 0, 0]} scale={[FAN_CLOSED, FAN_CLOSED, 1]}>
        <mesh>
          {/* A sector rather than a full circle: a peacock's fan is a wide arch, not a disc. */}
          <circleGeometry args={[0.085, 20, Math.PI * 0.12, Math.PI * 0.76]} />
          <meshStandardMaterial color={FAN_COLOR} roughness={0.8} flatShading side={THREE.DoubleSide} />
        </mesh>
        {/* Gold rim, a hair behind the fan so it reads as the feather tips. */}
        <mesh position={[0, 0, -0.002]} scale={1.14}>
          <circleGeometry args={[0.085, 20, Math.PI * 0.12, Math.PI * 0.76]} />
          <meshStandardMaterial color={FAN_EDGE_COLOR} roughness={0.85} flatShading side={THREE.DoubleSide} />
        </mesh>
        {EYE_SPOTS.map(([angle, radius], i) => (
          <mesh
            key={i}
            position={[Math.sin(angle) * radius, Math.cos(angle) * radius, 0.002]}
            scale={[1, 1, 0.35]}
          >
            <sphereGeometry args={[0.008, 5, 4]} />
            <meshStandardMaterial color={EYE_COLOR} roughness={0.7} flatShading />
          </mesh>
        ))}
      </group>

      <mesh ref={bodyRef} position={[0, 0.028, 0]} scale={[1, 0.85, 1.25]}>
        <sphereGeometry args={[0.024, 7, 6]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.7} flatShading />
      </mesh>

      {/* Neck and head on one pivot at the shoulders, so a peck swings both. */}
      <group ref={neckRef} position={[0, 0.036, 0.016]}>
        <mesh position={[0, 0.018, 0.006]} rotation={[0.25, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.008, 0.04, 5]} />
          <meshStandardMaterial color={NECK_COLOR} roughness={0.7} flatShading />
        </mesh>
        <mesh position={[0, 0.04, 0.014]}>
          <sphereGeometry args={[0.011, 6, 5]} />
          <meshStandardMaterial color={NECK_COLOR} roughness={0.7} flatShading />
        </mesh>
        {/* Beak, and the three-feather crest that makes the head unmistakably a peacock's. */}
        <mesh position={[0, 0.039, 0.024]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.004, 0.012, 4]} />
          <meshStandardMaterial color={FAN_EDGE_COLOR} roughness={0.8} flatShading />
        </mesh>
        {[-0.3, 0, 0.3].map((tilt, i) => (
          <mesh key={i} position={[Math.sin(tilt) * 0.006, 0.054, 0.012]} rotation={[0, 0, tilt]}>
            <coneGeometry args={[0.0016, 0.014, 3]} />
            <meshStandardMaterial color={FAN_COLOR} roughness={0.8} flatShading />
          </mesh>
        ))}
      </group>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.008, 0.009, 0.002]}>
          <cylinderGeometry args={[0.002, 0.002, 0.018, 4]} />
          <meshStandardMaterial color={LEG_COLOR} roughness={0.9} flatShading />
        </mesh>
      ))}

      {/* Well above and to one side of the opened fan. The fan stands ~0.28 world
          units tall at full spread, which at this camera distance is about the
          height of the label bubble itself — put the bubble any closer and it
          hides the entire display it is announcing. */}
      {reacting && (
        <Html position={[0.11, 0.3, 0.06]} center zIndexRange={CRITTER_HTML_Z}>
          <div className="marker-label-glass pointer-events-none whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream">
            Kijk mij! 🦚
          </div>
        </Html>
      )}
    </group>
  );
}
