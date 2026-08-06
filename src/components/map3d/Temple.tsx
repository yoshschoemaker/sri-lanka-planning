import { useMemo } from "react";
import { getTerrainSurfaceY } from "./Highlands";

const WALL_COLOR = "#f2ead9";
const ROOF_COLOR = "#9c5030";
const ROOF_COLOR_LIGHT = "#c2683f";
const SPIRE_COLOR = "#c9a227";
/** Body-primitive dimensions below are tuned at 1x; this blows the whole building up so its tiered roof actually reads at diorama viewing distance (matches Stupa/Leopard/Elephant's own scale-up). */
const SCALE = 1.7;

/**
 * Purely decorative low-poly vihara: a stepped, tiered roof rather than
 * Stupa.tsx's dome, so it reads as "temple" rather than a second dagoba. Used
 * near Kandy (Temple of the Tooth) and Dambulla (cave temple daytrip) —
 * anywhere the itinerary centers on a real temple rather than a stupa.
 * getTerrainSurfaceY looks up the real elevation tier under (x, z) since
 * both sit up in the hill country, not on the flat coastal base.
 */
export function Temple({ x, z }: { x: number; z: number }) {
  const y = useMemo(() => getTerrainSurfaceY(x, z), [x, z]);

  return (
    <group position={[x, y, z]} scale={SCALE}>
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[0.09, 0.05, 0.09]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.065, 0]}>
        <coneGeometry args={[0.075, 0.035, 4]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.8} flatShading />
      </mesh>

      <mesh position={[0, 0.098, 0]}>
        <boxGeometry args={[0.052, 0.032, 0.052]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.125, 0]}>
        <coneGeometry args={[0.044, 0.028, 4]} />
        <meshStandardMaterial color={ROOF_COLOR_LIGHT} roughness={0.8} flatShading />
      </mesh>

      <mesh position={[0, 0.163, 0]}>
        <coneGeometry args={[0.009, 0.055, 6]} />
        <meshStandardMaterial color={SPIRE_COLOR} roughness={0.5} metalness={0.3} flatShading />
      </mesh>
    </group>
  );
}
