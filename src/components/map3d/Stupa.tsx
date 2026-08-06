import { ISLAND_TOP_Y } from "./Island";

const BASE_COLOR = "#c2683f";
const BASE_COLOR_LIGHT = "#d99464";
const DOME_COLOR = "#f5efe0";
const ALTAR_COLOR = "#e7d5ac";
const SPIRE_COLOR = "#c9a227";

const BASE_RADIUS = 0.105;

// Stacked bottom-up so each tier's position is derived from the one below
// it, rather than eyeballed absolute numbers that would drift out of sync
// if any one tier's height changed.
const PLINTH_H = 0.024;
const TERRACE_H = 0.022;
const DOME_RADIUS = BASE_RADIUS * 0.8;
const DOME_SCALE_Y = 1.25; // bulbous "bell" profile — real dagobas are rounder than a plain hemisphere
const DOME_H = DOME_RADIUS * DOME_SCALE_Y;
const ALTAR_H = 0.03;
const SPIRE_TIER_H = 0.028;

const TERRACE_Y = PLINTH_H;
const DOME_Y = TERRACE_Y + TERRACE_H;
const ALTAR_Y = DOME_Y + DOME_H;
const SPIRE_BASE_Y = ALTAR_Y + ALTAR_H;

/**
 * A real, named landmark (Anuradhapura's skyline is still defined by dagobas
 * like Ruwanwelisaya), so it's modeled after the actual silhouette rather
 * than a generic dome-on-a-base: wide plinth, terraced base, a bulbous bell
 * dome (not a plain hemisphere — real dagobas read rounder/bell-shaped), the
 * square "hataraskotuwa" altar box, and a tapering multi-tier spire, in that
 * order bottom to top.
 */
export function Stupa({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, ISLAND_TOP_Y, z]}>
      <mesh position={[0, PLINTH_H / 2, 0]}>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS * 1.1, PLINTH_H, 10]} />
        <meshStandardMaterial color={BASE_COLOR} roughness={0.9} flatShading />
      </mesh>

      <mesh position={[0, TERRACE_Y + TERRACE_H / 2, 0]}>
        <cylinderGeometry args={[BASE_RADIUS * 0.82, BASE_RADIUS * 0.94, TERRACE_H, 10]} />
        <meshStandardMaterial color={BASE_COLOR_LIGHT} roughness={0.9} flatShading />
      </mesh>

      <mesh position={[0, DOME_Y, 0]} scale={[1, DOME_SCALE_Y, 1]}>
        <sphereGeometry args={[DOME_RADIUS, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={DOME_COLOR} roughness={0.65} flatShading />
      </mesh>

      <mesh position={[0, ALTAR_Y + ALTAR_H / 2, 0]}>
        <boxGeometry args={[BASE_RADIUS * 0.4, ALTAR_H, BASE_RADIUS * 0.4]} />
        <meshStandardMaterial color={ALTAR_COLOR} roughness={0.8} flatShading />
      </mesh>

      {[0, 1, 2].map((i) => {
        const scale = 1 - i * 0.22;
        const y = SPIRE_BASE_Y + i * SPIRE_TIER_H + SPIRE_TIER_H / 2;
        return (
          <mesh key={i} position={[0, y, 0]} scale={[scale, 1, scale]}>
            <coneGeometry args={[BASE_RADIUS * 0.22, SPIRE_TIER_H, 8]} />
            <meshStandardMaterial color={SPIRE_COLOR} roughness={0.55} metalness={0.2} flatShading />
          </mesh>
        );
      })}

      <mesh position={[0, SPIRE_BASE_Y + 3 * SPIRE_TIER_H + 0.02, 0]}>
        <coneGeometry args={[0.006, 0.045, 6]} />
        <meshStandardMaterial color={SPIRE_COLOR} roughness={0.5} metalness={0.25} flatShading />
      </mesh>
    </group>
  );
}
