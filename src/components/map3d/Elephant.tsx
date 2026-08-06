import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useClickReaction } from "../../utils/useClickReaction";
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

/**
 * Purely decorative low-poly elephant, a nod to Udawalawe's herds. Ears and
 * trunk are the two features that keep a silhouette this small readable as
 * "elephant" rather than "grey blob". Clicking it plays a one-shot ear flap
 * + trunk raise, the same "wake up the diorama" easter egg Leopard/Whale/
 * Turtle each have their own version of.
 */
export function Elephant({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const earRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trunkRef = useRef<THREE.Mesh>(null);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);

  useFrame(() => {
    if (prefersReducedMotion) return;
    const e = envelope();
    for (let i = 0; i < earRefs.current.length; i++) {
      const ear = earRefs.current[i];
      if (!ear) continue;
      const side = i === 0 ? -1 : 1;
      ear.rotation.z = side * (e ? 0.6 + Math.sin(e.elapsed * 9) * 0.35 * e.strength : 0.6);
    }
    if (trunkRef.current) trunkRef.current.rotation.x = e ? 0.55 - 0.5 * e.strength : 0.55;
  });

  return (
    <group
      position={[x, ISLAND_TOP_Y, z]}
      rotation={[0, 1.3, 0]}
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
      <mesh position={[0, 0.042, 0]} scale={[1, 0.85, 1.4]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
      </mesh>

      <mesh position={[0, 0.05, 0.065]} scale={[0.85, 0.85, 0.85]}>
        <sphereGeometry args={[0.032, 7, 6]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
      </mesh>

      {[-1, 1].map((side, i) => (
        <mesh
          key={side}
          ref={(m) => {
            earRefs.current[i] = m;
          }}
          position={[side * 0.038, 0.058, 0.055]}
          rotation={[0, 0, side * 0.6]}
          scale={[0.85, 1.2, 0.18]}
        >
          <sphereGeometry args={[0.026, 6, 5]} />
          <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
        </mesh>
      ))}

      <mesh ref={trunkRef} position={[0, 0.025, 0.09]} rotation={[0.55, 0, 0]}>
        <coneGeometry args={[0.009, 0.05, 5]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
      </mesh>

      {LEG_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.012, dz]}>
          <cylinderGeometry args={[0.011, 0.011, 0.024, 5]} />
          <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
        </mesh>
      ))}

      <mesh position={[0, 0.04, -0.068]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.003, 0.03, 4]} />
        <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
      </mesh>

      {reacting && (
        <Html position={[0, 0.1, 0.05]} center>
          <div className="pointer-events-none whitespace-nowrap rounded-full bg-ink/95 px-2.5 py-1 font-serif text-xs font-semibold text-cream shadow-[var(--shadow-card)]">
            Toet toet! 🐘
          </div>
        </Html>
      )}
    </group>
  );
}
