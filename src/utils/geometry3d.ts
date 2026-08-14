import { ISLAND_MAIN_RING } from "../data/srilankaShape3d";

export type Ring = readonly (readonly [number, number])[];

/**
 * Even-odd crossing test for a point against a closed ring in world (x, z)
 * space. Lifted out of Highlands.tsx (where it started life as the terrain
 * tier lookup's private helper) once vegetation/rock/paddy scatter needed the
 * exact same test against the coastline ring — one implementation, so a fix to
 * the edge-case handling can't drift between terrain and decoration.
 */
export function pointInRing(x: number, z: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a world (x, z) falls on the main island. Deliberately ignores the four islets: they're far too small to scatter anything onto. */
export function isOnLand(x: number, z: number): boolean {
  return pointInRing(x, z, ISLAND_MAIN_RING);
}

/** Shortest distance from a point to a line segment, in world units. */
function distanceToSegment(x: number, z: number, x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return Math.hypot(x - x1, z - z1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / lengthSq));
  return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
}

/**
 * Shortest distance from a point to a ring's edge — not to its vertices, which
 * on the coastline's long simplified segments would overestimate badly.
 * Used two ways by the scatter: to carve out a coastal strip (coconut palms
 * belong within ~0.25 units of the sea, broadleaf forest does not), and to keep
 * everything clear of the island's beveled cut edge, where a tree would
 * otherwise visibly overhang into the water.
 */
export function distanceToRing(x: number, z: number, ring: Ring): number {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const d = distanceToSegment(x, z, xj, zj, xi, zi);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Grid-accelerated near-field distance to a ring.
 *
 * distanceToRing tests all 177 coastline segments, which the scatter calls once
 * per candidate point — measurably the most expensive thing in the whole pass.
 * Every caller only ever compares the result against a small threshold (the
 * coastal strip is 0.28 world units wide, the keep-off-the-bevel margin 0.045),
 * so exactness beyond a cutoff is wasted work: this buckets the segments into a
 * uniform grid and only measures the ones in the query point's own cell,
 * returning `cutoff` for anything farther.
 *
 * `cutoff` must exceed every threshold callers test against, or a point just
 * outside the grid's reach would compare as if it were exactly at the cutoff.
 */
export function createRingDistanceField(ring: Ring, cutoff: number): (x: number, z: number) => number {
  // One cell per cutoff means a segment reachable from a query point is always
  // in that point's own cell, since inserts fan out over the segment's bounding
  // box expanded by the cutoff.
  const cell = cutoff;
  const buckets = new Map<number, number[]>();
  const key = (cx: number, cz: number) => (cx + 512) * 4096 + (cz + 512);

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const minX = Math.floor((Math.min(xi, xj) - cutoff) / cell);
    const maxX = Math.floor((Math.max(xi, xj) + cutoff) / cell);
    const minZ = Math.floor((Math.min(zi, zj) - cutoff) / cell);
    const maxZ = Math.floor((Math.max(zi, zj) + cutoff) / cell);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const k = key(cx, cz);
        const bucket = buckets.get(k);
        if (bucket) bucket.push(i);
        else buckets.set(k, [i]);
      }
    }
  }

  return (x, z) => {
    const candidates = buckets.get(key(Math.floor(x / cell), Math.floor(z / cell)));
    if (!candidates) return cutoff;
    let min = cutoff;
    for (const i of candidates) {
      const [xi, zi] = ring[i];
      const [xj, zj] = ring[(i - 1 + ring.length) % ring.length];
      const d = distanceToSegment(x, z, xj, zj, xi, zi);
      if (d < min) min = d;
    }
    return min;
  };
}

/**
 * Beyond this the exact coastline distance stops being computed. Comfortably
 * above every threshold the habitat predicates in src/data/habitats.ts test
 * against; raise it if a predicate ever needs to reason about deeper inland.
 */
export const COAST_DISTANCE_CUTOFF = 0.45;

/**
 * Distance from a point to the island's coastline, saturating at
 * COAST_DISTANCE_CUTOFF. Use distanceToRing directly if you genuinely need the
 * unbounded distance.
 */
export const distanceToCoast = createRingDistanceField(ISLAND_MAIN_RING, COAST_DISTANCE_CUTOFF);

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function ringBounds(ring: Ring): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

/** The island's bounding box, the sampling window every land scatter starts from. */
export const ISLAND_BOUNDS: Bounds = ringBounds(ISLAND_MAIN_RING);
