import { useMemo } from "react";
import { ISLAND_TOP_Y } from "./Island";

const BUSH_COLOR_A = "#3d7462";
const BUSH_COLOR_B = "#4a8a70";

/** Deterministic scatter so the tiny cluster stays stable across re-renders instead of reshuffling. */
const OFFSETS: [number, number, number][] = [
  [-0.08, 0.04, 0],
  [0.05, -0.06, 1],
  [0.1, 0.08, 0],
  [-0.02, -0.11, 1],
  [-0.13, -0.03, 0],
];

/** A handful of tea-bush dots on the highland plateau — a nod to the hill country's tea estates, kept tiny enough to read as texture rather than clutter. */
export function TeaBushes({ x, z, baseY }: { x: number; z: number; baseY: number }) {
  const positions = useMemo(() => OFFSETS.map(([dx, dz, c]): [number, number, number] => [x + dx, z + dz, c]), [x, z]);

  return (
    <group position={[0, ISLAND_TOP_Y + baseY, 0]}>
      {positions.map(([px, pz, colorIndex], i) => (
        <mesh key={i} position={[px, 0.02, pz]}>
          <sphereGeometry args={[0.028, 6, 5]} />
          <meshStandardMaterial color={colorIndex === 0 ? BUSH_COLOR_A : BUSH_COLOR_B} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}
