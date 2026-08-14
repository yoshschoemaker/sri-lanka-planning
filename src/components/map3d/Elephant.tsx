import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import { ISLAND_TOP_Y } from "./Island";

const BODY_COLOR = "#96908a";
const BODY_COLOR_DARK = "#5c5650";
/** Body-primitive dimensions below are tuned at 1x; this blows the whole critter up so it actually reads at diorama viewing distance. */
const SCALE = 2.6;

const LEG_OFFSETS: [number, number][] = [
  [-0.025, -0.038],
  [0.025, -0.038],
  [-0.025, 0.03],
  [0.025, 0.03],
];

/** Seconds the ear-flap + trunk-raise reaction plays before settling back to rest. */
const REACTION_DURATION = 1.6;

const BASE_TURN = 1.3;
const TRUNK_REST_X = 0.55;
const EAR_REST_Z = 0.6;

/**
 * Purely decorative low-poly elephant, a nod to Yala's herds. Ears and
 * trunk are the two features that keep a silhouette this small readable as
 * "elephant" rather than "grey blob". It is never fully still: the trunk
 * sways and the flanks breathe continuously, and every so often it shakes
 * its ears and swishes its tail on its own (useIdleMotion). Clicking it
 * plays a louder one-shot ear flap + trunk raise, the same "wake up the
 * diorama" easter egg Leopard/Whale/Turtle each have their own version of.
 */
export function Elephant({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const earRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trunkRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 0.8, minGap: 5, maxGap: 13, duration: 1.8 });

  useFrame(({ clock }) => {
    if (prefersReducedMotion) return;
    const { t, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime);
    const e = envelope();

    for (let i = 0; i < earRefs.current.length; i++) {
      const ear = earRefs.current[i];
      if (!ear) continue;
      const side = i === 0 ? -1 : 1;
      const flap =
        Math.sin(t * 1.1 + i) * 0.045 +
        Math.sin(fidgetElapsed * 7) * 0.22 * fidget +
        (e ? Math.sin(e.elapsed * 9) * 0.35 * e.strength : 0);
      ear.rotation.z = side * (EAR_REST_Z + flap);
    }

    if (trunkRef.current) {
      trunkRef.current.rotation.x = TRUNK_REST_X + Math.sin(t * 0.9) * 0.08 - 0.28 * fidget - (e ? 0.5 * e.strength : 0);
      trunkRef.current.rotation.z = Math.sin(t * 0.55) * 0.12 + Math.sin(fidgetElapsed * 4) * 0.1 * fidget;
    }

    // Flanks rise and fall; scale rather than position so the feet stay planted.
    if (bodyRef.current) bodyRef.current.scale.set(1 + breath * 0.02, 0.85 + breath * 0.015, 1.4);
    if (headRef.current) headRef.current.rotation.x = Math.sin(t * 0.7) * 0.04 - 0.08 * fidget;
    if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * 1.3) * 0.12 + Math.sin(fidgetElapsed * 8) * 0.35 * fidget;
    if (groupRef.current) groupRef.current.rotation.y = BASE_TURN + Math.sin(fidgetElapsed * 2.2) * 0.1 * fidget;
  });

  return (
    <group
      ref={groupRef}
      position={[x, ISLAND_TOP_Y, z]}
      rotation={[0, BASE_TURN, 0]}
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
      <mesh ref={bodyRef} position={[0, 0.042, 0]} scale={[1, 0.85, 1.4]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
      </mesh>

      {/* Head, ears and trunk share a pivot at the neck so a nod carries all three. */}
      <group ref={headRef} position={[0, 0.05, 0.065]}>
        <mesh scale={[0.85, 0.85, 0.85]}>
          <sphereGeometry args={[0.032, 7, 6]} />
          <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
        </mesh>

        {[-1, 1].map((side, i) => (
          <mesh
            key={side}
            ref={(m) => {
              earRefs.current[i] = m;
            }}
            position={[side * 0.038, 0.008, -0.01]}
            rotation={[0, 0, side * EAR_REST_Z]}
            scale={[0.85, 1.2, 0.18]}
          >
            <sphereGeometry args={[0.026, 6, 5]} />
            <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
          </mesh>
        ))}

        <mesh ref={trunkRef} position={[0, -0.025, 0.025]} rotation={[TRUNK_REST_X, 0, 0]}>
          <coneGeometry args={[0.009, 0.05, 5]} />
          <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
        </mesh>
      </group>

      {LEG_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.012, dz]}>
          <cylinderGeometry args={[0.011, 0.011, 0.024, 5]} />
          <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
        </mesh>
      ))}

      <mesh ref={tailRef} position={[0, 0.04, -0.068]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.003, 0.03, 4]} />
        <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
      </mesh>

      {reacting && (
        <Html position={[0, 0.1, 0.05]} center zIndexRange={CRITTER_HTML_Z}>
          <div className="marker-label-glass pointer-events-none whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream">
            Toet toet! 🐘
          </div>
        </Html>
      )}
    </group>
  );
}
