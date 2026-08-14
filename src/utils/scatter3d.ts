import { ISLAND_TOP_Y } from "../components/map3d/Island";
import { getTerrainTier, TIER_HEIGHT } from "../components/map3d/Highlands";
import { getWetness } from "./climateZone3d";
import { distanceToCoast, distanceToInland, isInland, ISLAND_BOUNDS, isOnLand } from "./geometry3d";

/**
 * Deterministic scatter engine for the diorama's procedural decoration
 * (vegetation, boulders, paddy terraces). Hand-authored coordinate lists like
 * src/data/mapDecor.ts's PALM_TREE_POSITIONS stay the right tool for named
 * props you want in one exact spot; this is for the hundreds of anonymous
 * background objects, where hand-placing is neither maintainable nor the point.
 *
 * Three properties matter, and shape the whole design:
 *
 *  1. **Deterministic.** A fixed seed, so a re-render or a hot reload never
 *     reshuffles the forest. Same reasoning as TeaBushes' original hardcoded
 *     OFFSETS table, just generated instead of typed out.
 *  2. **One shared pass.** Terrain tier lookup walks all 18 contour rings, so
 *     it's by far the most expensive part per candidate point. Every species is
 *     therefore resolved in a single pass over one candidate stream, paying that
 *     cost once per point rather than once per point per species.
 *  3. **Never collides.** Candidates are rejected against the real marker/route
 *     layout (see src/utils/mapExclusions.ts) and against every already-placed
 *     item of any species, so decoration can't grow through a pin, a label, a
 *     route line, or another tree.
 */

/** A circular keep-out area in world (x, z). */
export interface Exclusion {
  x: number;
  z: number;
  r: number;
}

/** What a habitat predicate gets to decide on. */
export interface PlacementContext {
  /** Terrain tier index: -1 on the flat lowlands, 0..6 up the real elevation bands. */
  tier: number;
  /** 0 = dry zone, 1 = wet zone (src/utils/climateZone3d.ts). */
  wetness: number;
  /** World-unit distance to the coastline. */
  coastDistance: number;
  /**
   * World-unit distance to the beach shelf's inner edge. What coastal habitats
   * should key on rather than coastDistance: the shelf runs from 0.09 wide at
   * Jaffna to 0.30 at Mirissa, so "within X of the sea" means a different
   * thing on every coast, while "within X of where the sand ends" doesn't.
   */
  inlandDistance: number;
}

export interface ScatterItem {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  /**
   * Two spare 0..1 draws from the same PRNG, so a renderer can pick a
   * per-instance color, tilt or sub-variant without threading a second random
   * source through (and without Math.random(), which would break determinism).
   */
  variant: number;
  jitter: number;
  tier: number;
  wetness: number;
}

export interface HabitatSpec<K extends string> {
  key: K;
  count: number;
  /** Minimum world-unit distance to any other placed item, of any species. */
  minSpacing: number;
  accept: (context: PlacementContext) => boolean;
  /** Uniform scale range; the renderer's own base size is multiplied by this. */
  scaleRange: readonly [number, number];
}

/** Mulberry32: tiny, fast, good enough distribution for decoration, and identical across browsers. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Uniform-grid index over the exclusion circles. Without it, every candidate
 * point would be tested against all ~250 exclusions (10 stops, 3 daytrips, a
 * couple hundred route samples, plus every hand-placed prop), which dominates
 * the whole scatter.
 */
interface Grid<T> {
  cell: number;
  buckets: Map<number, T[]>;
}

/** Packs a cell coordinate pair into one integer key. The ±512 offset keeps negative world coordinates from colliding with positive ones. */
function cellKey(cx: number, cz: number): number {
  return (cx + 512) * 4096 + (cz + 512);
}

function createGrid<T>(cell: number): Grid<T> {
  return { cell, buckets: new Map() };
}

function gridInsert<T>(grid: Grid<T>, x: number, z: number, radius: number, value: T): void {
  const min = Math.floor((x - radius) / grid.cell);
  const maxX = Math.floor((x + radius) / grid.cell);
  const minZ = Math.floor((z - radius) / grid.cell);
  const maxZ = Math.floor((z + radius) / grid.cell);
  for (let cx = min; cx <= maxX; cx++) {
    for (let cz = minZ; cz <= maxZ; cz++) {
      const key = cellKey(cx, cz);
      const bucket = grid.buckets.get(key);
      if (bucket) bucket.push(value);
      else grid.buckets.set(key, [value]);
    }
  }
}

/** Everything indexed in the single cell containing (x, z). Correct only because inserts fan out over every cell a circle touches. */
function gridAt<T>(grid: Grid<T>, x: number, z: number): T[] | undefined {
  return grid.buckets.get(cellKey(Math.floor(x / grid.cell), Math.floor(z / grid.cell)));
}

export interface ScatterHabitatsOptions<K extends string> {
  seed: number;
  /**
   * Evaluated in order: a candidate goes to the first spec that still needs
   * items and accepts it. So put the pickiest habitats first, or a broad one
   * will eat the candidates a narrow one needed.
   */
  specs: readonly HabitatSpec<K>[];
  exclusions: readonly Exclusion[];
  /** Keeps items off the island's beveled cut edge, where they'd visibly overhang the water. */
  minCoastDistance: number;
  /** Candidate attempts per requested item. Higher = the narrowest habitats fill up more reliably, at linear cost. */
  attemptsPerItem?: number;
}

/**
 * Places every species in one pass and returns them grouped by key. A species
 * whose habitat is too small to fit its requested count simply gets fewer items
 * — the attempt budget is a hard bound, so this can never spin.
 */
export function scatterHabitats<K extends string>({
  seed,
  specs,
  exclusions,
  minCoastDistance,
  attemptsPerItem = 30,
}: ScatterHabitatsOptions<K>): Record<K, ScatterItem[]> {
  const result = {} as Record<K, ScatterItem[]>;
  for (const spec of specs) result[spec.key] = [];
  if (specs.length === 0) return result;

  const exclusionGrid = createGrid<Exclusion>(0.5);
  let maxExclusionRadius = 0;
  for (const exclusion of exclusions) {
    gridInsert(exclusionGrid, exclusion.x, exclusion.z, exclusion.r, exclusion);
    if (exclusion.r > maxExclusionRadius) maxExclusionRadius = exclusion.r;
  }

  const maxSpacing = Math.max(
    0.01,
    specs.reduce((max, spec) => Math.max(max, spec.minSpacing), 0),
  );
  // One shared grid across all species: cross-species spacing is what stops a
  // boulder from materialising inside a tree. Every placed point fans out over
  // `maxSpacing` rather than its own (possibly smaller) spacing, because a later
  // candidate from a wider-spaced species queries out to that larger radius and
  // would otherwise miss a tightly-spaced neighbour sitting just outside its cell.
  const placedGrid = createGrid<{ x: number; z: number; spacing: number }>(maxSpacing);

  const random = createRandom(seed);
  const totalWanted = specs.reduce((sum, spec) => sum + spec.count, 0);
  const remaining = new Map<K, number>(specs.map((spec) => [spec.key, spec.count]));
  let placedTotal = 0;

  const spanX = ISLAND_BOUNDS.maxX - ISLAND_BOUNDS.minX;
  const spanZ = ISLAND_BOUNDS.maxZ - ISLAND_BOUNDS.minZ;
  const maxAttempts = totalWanted * attemptsPerItem;

  for (let attempt = 0; attempt < maxAttempts && placedTotal < totalWanted; attempt++) {
    const x = ISLAND_BOUNDS.minX + random() * spanX;
    const z = ISLAND_BOUNDS.minZ + random() * spanZ;
    // Drawn unconditionally, before any rejection, so the PRNG advances by a
    // fixed amount per attempt. That keeps the candidate stream identical
    // regardless of how many items each species asks for, which is what makes
    // the low- and high-detail passes read as the same map at two densities
    // rather than two unrelated layouts.
    const rotationDraw = random();
    const scaleDraw = random();
    const variant = random();
    const jitter = random();

    if (!isOnLand(x, z)) continue;
    const coastDistance = distanceToCoast(x, z);
    if (coastDistance < minCoastDistance) continue;
    // Nothing grows on bare sand, and nothing may straddle the step down onto
    // it. That emptiness is most of what makes the shelf read as a beach.
    if (!isInland(x, z, coastDistance)) continue;

    const nearbyExclusions = gridAt(exclusionGrid, x, z);
    if (nearbyExclusions?.some((e) => (x - e.x) ** 2 + (z - e.z) ** 2 < e.r * e.r)) continue;

    const tier = getTerrainTier(x, z);
    const context: PlacementContext = {
      tier,
      wetness: getWetness(x, z, tier),
      coastDistance,
      inlandDistance: distanceToInland(x, z),
    };

    for (const spec of specs) {
      if ((remaining.get(spec.key) ?? 0) <= 0) continue;
      if (!spec.accept(context)) continue;

      const nearbyPlaced = gridAt(placedGrid, x, z);
      const tooClose = nearbyPlaced?.some((p) => {
        const limit = Math.max(spec.minSpacing, p.spacing);
        return (x - p.x) ** 2 + (z - p.z) ** 2 < limit * limit;
      });
      if (tooClose) break;

      const [minScale, maxScale] = spec.scaleRange;
      result[spec.key].push({
        x,
        // Inlined rather than calling getTerrainSurfaceY, which would repeat the
        // 18-ring tier walk we already paid for above — the single most
        // expensive operation in this loop.
        y: ISLAND_TOP_Y + (tier + 1) * TIER_HEIGHT,
        z,
        rotationY: rotationDraw * Math.PI * 2,
        scale: minScale + scaleDraw * (maxScale - minScale),
        variant,
        jitter,
        tier,
        wetness: context.wetness,
      });
      gridInsert(placedGrid, x, z, maxSpacing, { x, z, spacing: spec.minSpacing });
      remaining.set(spec.key, (remaining.get(spec.key) ?? 0) - 1);
      placedTotal++;
      break;
    }
  }

  return result;
}
