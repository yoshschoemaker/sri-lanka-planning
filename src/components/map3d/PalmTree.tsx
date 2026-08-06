import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ISLAND_TOP_Y } from "./Island";

const TRUNK_HEIGHT = 0.32;
const TRUNK_COLOR = "#6b4226";
const FROND_COLOR_A = "#2f5d4e";
const FROND_COLOR_B = "#3d7462";
const FROND_COUNT = 5;

/** Kept tiny — a breeze, not a gale — so it reads as ambient life rather than motion competing for attention. */
const SWAY_AMPLITUDE = 0.035;
const SWAY_SPEED = 0.55;

/**
 * Purely decorative low-poly palm tree, placed once on an empty stretch of
 * the island (the eastern coast, which no stop or daytrip visits) to give
 * the diorama a bit of life. Built from the same flat-shaded, few-segment
 * primitives as Island/StopMarker3D rather than an imported model, so it
 * stays visually consistent and doesn't pull in any asset loading.
 */
export function PalmTree({ x, z }: { x: number; z: number }) {
  const frondAngles = useMemo(() => Array.from({ length: FROND_COUNT }, (_, i) => (i / FROND_COUNT) * Math.PI * 2), []);
  const crownRef = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const crown = crownRef.current;
    if (!crown) return;
    const t = clock.elapsedTime * SWAY_SPEED + phase.current;
    crown.rotation.x = Math.sin(t) * SWAY_AMPLITUDE;
    crown.rotation.z = Math.sin(t * 0.8) * SWAY_AMPLITUDE;
  });

  return (
    <group position={[x, ISLAND_TOP_Y, z]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, TRUNK_HEIGHT / 2, 0]} rotation={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.014, 0.024, TRUNK_HEIGHT, 5]} />
        <meshStandardMaterial color={TRUNK_COLOR} roughness={0.95} flatShading />
      </mesh>

      <group ref={crownRef} position={[0.02, TRUNK_HEIGHT, 0]}>
        {frondAngles.map((angle, i) => (
          // Outer group picks the compass direction a frond points in;
          // the inner mesh then droops outward/down along *that* group's
          // own local Z, offset first so it droops away from the trunk
          // instead of back through it.
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh position={[0, 0.01, 0.07]} rotation={[Math.PI / 2.4, 0, 0]} scale={[0.55, 1, 2.1]}>
              <coneGeometry args={[0.065, 0.24, 4]} />
              <meshStandardMaterial color={i % 2 === 0 ? FROND_COLOR_A : FROND_COLOR_B} roughness={0.9} flatShading />
            </mesh>
          </group>
        ))}
      </group>

      {[
        [0.02, -0.015],
        [-0.015, 0.02],
      ].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, TRUNK_HEIGHT - 0.03, dz]}>
          <sphereGeometry args={[0.02, 6, 5]} />
          <meshStandardMaterial color={TRUNK_COLOR} roughness={0.95} flatShading />
        </mesh>
      ))}
    </group>
  );
}
