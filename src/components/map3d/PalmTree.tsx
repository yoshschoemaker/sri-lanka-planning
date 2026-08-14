import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getTerrainSurfaceY } from "./Highlands";
import { buildFrondGeometry } from "./frondGeometry";

const TRUNK_HEIGHT = 0.32;
const TRUNK_COLOR = "#6b4226";
const FROND_COLOR_A = "#2f5d4e";
const FROND_COLOR_B = "#3d7462";
/** Seven rather than five: five broad leaves still leave enough sky between them to read as a star, seven closes the crown. */
const FROND_COUNT = 7;

/** One blade shape for every frond on every hero palm; the per-frond pitch and scale below keep them from looking stamped. */
const FROND_GEOMETRY = buildFrondGeometry();

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
  // Golden-angle-ish rather than an even fan, plus a little pitch and length
  // variation per frond: a perfectly regular crown is what made the old one read
  // as a manufactured star instead of a plant.
  const fronds = useMemo(
    () =>
      Array.from({ length: FROND_COUNT }, (_, i) => ({
        angle: (i / FROND_COUNT) * Math.PI * 2 + (i % 2) * 0.18,
        pitch: 0.1 - (i % 3) * 0.14,
        scale: 0.92 + ((i * 7) % 5) * 0.045,
      })),
    [],
  );
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
    <group position={[x, getTerrainSurfaceY(x, z), z]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, TRUNK_HEIGHT / 2, 0]} rotation={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.014, 0.024, TRUNK_HEIGHT, 5]} />
        <meshStandardMaterial color={TRUNK_COLOR} roughness={0.95} flatShading />
      </mesh>

      <group ref={crownRef} position={[0.02, TRUNK_HEIGHT, 0]}>
        {fronds.map(({ angle, pitch, scale }, i) => (
          // Outer group picks the compass direction a frond points in; the blade
          // itself is authored lying along +Z already arched and drooping (see
          // frondGeometry.ts), so all that's left here is the pitch it leaves the
          // crown at and a small offset clear of the trunk.
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh geometry={FROND_GEOMETRY} position={[0, 0.005, 0.012]} rotation={[pitch, 0, 0]} scale={scale}>
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
