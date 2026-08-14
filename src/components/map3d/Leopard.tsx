import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import { ISLAND_TOP_Y } from "./Island";

const COAT_COLOR = "#c9903f";
const SPOT_COLOR = "#5c3a1e";
/** Body-primitive dimensions below are tuned at 1x; this blows the whole critter up so it actually reads at diorama viewing distance. */
const SCALE = 2.6;

const LEG_OFFSETS: [number, number][] = [
  [-0.018, -0.032],
  [0.018, -0.032],
  [-0.018, 0.026],
  [0.018, 0.026],
];

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
 * Purely decorative low-poly leopard, a nod to Wilpattu's sightings. Body
 * sits low and long (crouching stance) rather than upright, which reads
 * better as "cat" than a sphere-with-legs would at this scale. The tail
 * curls and the ribs breathe non-stop, and now and then it looks around and
 * flicks the tail on its own (useIdleMotion). Clicking it plays a louder
 * one-shot stretch + tail flick, the same "wake up the diorama" easter egg
 * Elephant/Whale/Turtle each have their own version of.
 */
export function Leopard({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 1, minGap: 4, maxGap: 11, duration: 1.5 });

  useFrame(({ clock }) => {
    if (prefersReducedMotion) return;
    const { t, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime);
    const e = envelope();

    if (tailRef.current) {
      tailRef.current.rotation.z =
        Math.sin(t * 0.9) * 0.14 +
        Math.sin(fidgetElapsed * 11) * 0.3 * fidget +
        (e ? Math.sin(e.elapsed * 14) * 0.5 * e.strength : 0);
      tailRef.current.rotation.x = TAIL_REST_X + Math.sin(t * 0.6) * 0.07;
    }

    if (bodyRef.current) {
      // Ribs on the breath curve, plus the stretch a click or a fidget adds on top.
      bodyRef.current.scale.set(
        0.8 + breath * 0.012,
        0.7 + breath * 0.02,
        1.6 + Math.sin(fidgetElapsed * 4) * 0.06 * fidget + (e ? Math.sin(e.elapsed * 6) * 0.18 * e.strength : 0),
      );
    }

    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.45) * 0.06 + Math.sin(fidgetElapsed * 2.4) * 0.38 * fidget;
      headRef.current.rotation.x = Math.sin(t * 0.8) * 0.03 - 0.06 * fidget;
    }
  });

  return (
    <group
      position={[x, ISLAND_TOP_Y, z]}
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
      <mesh ref={bodyRef} position={[0, 0.024, 0]} scale={[0.8, 0.7, 1.6]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
      </mesh>

      {/* Head and ears share a pivot at the neck so a look-around carries both. */}
      <group ref={headRef} position={[0, 0.03, 0.062]}>
        <mesh scale={[0.75, 0.75, 0.75]}>
          <sphereGeometry args={[0.026, 7, 6]} />
          <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
        </mesh>

        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.014, 0.02, 0.006]}>
            <coneGeometry args={[0.008, 0.014, 4]} />
            <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
          </mesh>
        ))}
      </group>

      <mesh ref={tailRef} position={[0, 0.04, -0.07]} rotation={[TAIL_REST_X, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.003, 0.06, 5]} />
        <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
      </mesh>

      {LEG_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.008, dz]}>
          <cylinderGeometry args={[0.007, 0.007, 0.016, 5]} />
          <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
        </mesh>
      ))}

      {SPOT_OFFSETS.map(([dx, dy, dz], i) => (
        <mesh key={i} position={[dx, dy, dz]}>
          <sphereGeometry args={[0.006, 5, 4]} />
          <meshStandardMaterial color={SPOT_COLOR} roughness={0.9} flatShading />
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
