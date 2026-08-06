import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const BODY_COLOR = "#2c5b6e";
const BODY_COLOR_LIGHT = "#3d7a8f";
const SCALE = 2.9;
const BASE_Y = -0.15;

/**
 * A small blue whale (back and tail breaking the surface), a nod to
 * Mirissa's whale watching trips. Sits just above Water.tsx's plane like
 * FishSchool/Turtle/WaveCrest, further offshore since whale watching
 * happens well out at sea rather than right off the beach.
 */
export function Whale({ x, z }: { x: number; z: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.4 + phase.current;
    if (groupRef.current) groupRef.current.position.y = BASE_Y + Math.sin(t) * 0.012;
    if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * 1.3) * 0.15;
  });

  return (
    <group ref={groupRef} position={[x, BASE_Y, z]} rotation={[0, 0.3, 0]} scale={SCALE}>
      <mesh scale={[1, 0.5, 2.2]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.6} flatShading />
      </mesh>

      <mesh position={[0, 0.024, 0.01]} scale={[0.5, 0.5, 0.35]}>
        <coneGeometry args={[0.02, 0.03, 4]} />
        <meshStandardMaterial color={BODY_COLOR_LIGHT} roughness={0.6} flatShading />
      </mesh>

      <mesh ref={tailRef} position={[0, 0.012, -0.095]} scale={[1, 0.15, 0.6]}>
        <coneGeometry args={[0.03, 0.05, 3]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.6} flatShading />
      </mesh>
    </group>
  );
}
