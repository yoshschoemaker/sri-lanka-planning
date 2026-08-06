import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const SHELL_COLOR = "#3d6b4a";
const SKIN_COLOR = "#5c8f6e";
const SCALE = 2.6;
const BASE_Y = -0.14;

const FLIPPER_OFFSETS: [number, number][] = [
  [-0.026, -0.022],
  [0.026, -0.022],
  [-0.03, 0.018],
  [0.03, 0.018],
];

/**
 * A small sea turtle drifting just under the surface, a nod to the turtle
 * spotting/nesting-beach activities at Tangalle (Rekawa) and Hikkaduwa.
 * Sits just above Water.tsx's plane like FishSchool/WaveCrest.
 */
export function Turtle({ x, z }: { x: number; z: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime * 0.45 + phase.current;
    group.position.y = BASE_Y + Math.sin(t) * 0.01;
    group.rotation.z = Math.sin(t * 0.7) * 0.05;
  });

  return (
    <group ref={groupRef} position={[x, BASE_Y, z]} rotation={[0, 0.5, 0]} scale={SCALE}>
      <mesh scale={[1, 0.42, 0.8]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={SHELL_COLOR} roughness={0.8} flatShading />
      </mesh>

      <mesh position={[0, -0.002, 0.038]} scale={[0.55, 0.5, 0.55]}>
        <sphereGeometry args={[0.02, 6, 5]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.85} flatShading />
      </mesh>

      {FLIPPER_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, -0.006, dz]} rotation={[0, 0, dx > 0 ? 0.5 : -0.5]} scale={[0.9, 0.35, 0.55]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}
