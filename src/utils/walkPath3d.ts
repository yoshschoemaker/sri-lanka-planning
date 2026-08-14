import { getTerrainTier } from "../components/map3d/Highlands";
import { isInland } from "./geometry3d";
import type { WorldPoint } from "./projection3d";

export interface WalkPath {
  /** Position at t (0..1 from the start of the walk to its end). */
  pointAt(t: number): WorldPoint;
  /** Heading in radians around Y at t, for a model whose front faces local +z. */
  headingAt(t: number): number;
  /**
   * How long the route actually turned out to be, in world units — often less
   * than asked for, since the search below trades length for a route that stays
   * on one terrace. Callers scale their gait to this so a critter hemmed in by
   * the coast still walks properly rather than tiptoeing.
   */
  length: number;
}

/**
 * A short quadratic-bezier stroll around a home position: two end points and a
 * sideways bow, so the walker curves gently rather than sliding along a ruler.
 * Both ends sit on the same terrain terrace as the home position and stay
 * inland, so a critter never wanders off a tier step or onto the beach.
 */
export function createWalkPath(home: WorldPoint, length: number, bow = 0.25): WalkPath {
  const baseTier = getTerrainTier(home.x, home.z);
  let heading = Math.random() * Math.PI * 2;
  let bowSign = Math.random() < 0.5 ? -1 : 1;
  // Shorten the walk rather than abandon it: a home position hemmed in by the
  // coast or a tier step still gets a few paces, just fewer of them.
  let half = length * 0.05;

  search: for (const candidate of [length, length * 0.8, length * 0.6, length * 0.45, length * 0.3]) {
    for (let attempt = 0; attempt < 8; attempt++) {
      heading = Math.random() * Math.PI * 2;
      bowSign = Math.random() < 0.5 ? -1 : 1;
      if (fits(home, heading, candidate / 2, bow * bowSign, baseTier)) {
        half = candidate / 2;
        break search;
      }
    }
  }

  const dx = Math.sin(heading);
  const dz = Math.cos(heading);
  const start = { x: home.x - dx * half, z: home.z - dz * half };
  const end = { x: home.x + dx * half, z: home.z + dz * half };
  // Control point pushed perpendicular to the walk, which is what bows it.
  const control = {
    x: home.x + dz * bow * bowSign * half,
    z: home.z - dx * bow * bowSign * half,
  };

  const pointAt = (t: number): WorldPoint => {
    const u = 1 - t;
    return {
      x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
      z: u * u * start.z + 2 * u * t * control.z + t * t * end.z,
    };
  };

  return {
    pointAt,
    length: half * 2,
    headingAt: (t) => {
      // Bezier tangent: 2(1-t)(C-S) + 2t(E-C).
      const u = 1 - t;
      const tx = 2 * u * (control.x - start.x) + 2 * t * (end.x - control.x);
      const tz = 2 * u * (control.z - start.z) + 2 * t * (end.z - control.z);
      return Math.atan2(tx, tz);
    },
  };
}

function fits(home: WorldPoint, heading: number, half: number, bow: number, baseTier: number): boolean {
  const dx = Math.sin(heading);
  const dz = Math.cos(heading);
  for (let i = -1; i <= 1; i += 0.5) {
    const x = home.x + dx * half * i + dz * bow * half * (1 - Math.abs(i));
    const z = home.z + dz * half * i - dx * bow * half * (1 - Math.abs(i));
    if (!isInland(x, z)) return false;
    if (getTerrainTier(x, z) !== baseTier) return false;
  }
  return true;
}

/**
 * Maps an appearance's 0..1 progress onto 0..1 along the walk path: stride in,
 * stand still for a beat in the middle (graze, sniff the air, look around),
 * then stride out. Animals that walk at a constant speed from the moment they
 * appear to the moment they leave read as toys on a rail.
 */
export function walkEase(progress: number, pauseFrom = 0.42, pauseTo = 0.6): number {
  if (progress <= pauseFrom) return smoothstep(progress / pauseFrom) * pauseFrom;
  if (progress <= pauseTo) return pauseFrom;
  return pauseFrom + smoothstep((progress - pauseTo) / (1 - pauseTo)) * (1 - pauseFrom);
}

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
