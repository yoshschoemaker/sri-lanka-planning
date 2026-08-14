import type { WorldPoint } from "../utils/projection3d";

/**
 * Sri Lanka's inland water, which the diorama had none of: the island's whole dry
 * zone is characterised by two-thousand-year-old man-made irrigation tanks (the
 * reason cities like Anuradhapura and Polonnaruwa exist at all), the hill country
 * by reservoirs on the Mahaweli, and the west coast by lagoon marsh.
 *
 * Hand-authored rather than baked from Natural Earth's lakes layer, for the same
 * reason src/data/mapDecor.ts's props are: there are five of them, they're all
 * named places, and each needs checking against the marker layout anyway.
 * (Extending scripts/build-map.mjs to bake real hydrology is the alternative if
 * this ever wants to be exhaustive rather than representative.)
 *
 * Every position below was verified in world space: fully on land, and its centre
 * clear of every stop marker, daytrip marker and hand-placed prop. Where the
 * offset from the real coordinates is more than a rounding error, the reason is
 * given — usually that the real water body sits underneath the city marker that
 * names it.
 */
export interface WaterBody extends WorldPoint {
  /** Rough footprint radius in world units. */
  radius: number;
  /** Seed for the ring's jitter, so each body gets its own irregular outline and keeps it across reloads. */
  seed: number;
}

/**
 * Radii were raised after seeing the first render: at the diorama's default
 * framing the initially "realistic" sizes read as blue specks rather than as
 * water. Every one was re-checked afterwards to still sit fully on land, with its
 * rim clear of the coastline bevel.
 */
export const WATER_BODIES: WaterBody[] = [
  // Victoria Reservoir, the big Mahaweli dam east of Kandy (7.24N, 80.78E),
  // nudged 0.1 clear of the Kandy marker. Stands in for Kandy Lake too, which is
  // literally inside the city and so sits entirely under Kandy's own pin.
  { x: 0.118, z: 1.415, radius: 0.09, seed: 11 },
  // Nuwara Wewa, the great tank on Anuradhapura's east side (8.34N, 80.42E).
  // Offset 0.38 southeast, since the real tank laps against the city marker.
  { x: -0.481, z: -1.271, radius: 0.13, seed: 22 },
  // Parakrama Samudra at Polonnaruwa (7.94N, 80.96E), the "sea of Parakrama" —
  // nudged 0.2 south to clear Sigiriya's Lion Rock model.
  { x: 0.468, z: -0.333, radius: 0.14, seed: 33 },
  // Tissa Wewa at Tissamaharama (6.28N, 81.28E), the tank west of Yala. Pulled
  // 0.05 further inland than its real position so the enlarged rim keeps clear of
  // the south coast.
  { x: 1.085, z: 3.5, radius: 0.1, seed: 44 },
  // Muthurajawela, the coastal marsh south of Negombo's lagoon and a real Negombo
  // activity in the itinerary. Offset south of the two Negombo markers that share
  // that stretch of coast, and 0.08 inland of its true position: the real marsh
  // opens straight into the sea, which here would leave water overhanging the
  // island's cut edge.
  { x: -1.835, z: 2.189, radius: 0.085, seed: 55 },
];

/**
 * The Mahaweli, Sri Lanka's longest river: down out of the hill country east of
 * Kandy, north across the dry-zone plain past Polonnaruwa, and out at
 * Trincomalee. Control points, not a dense polyline — the renderer runs a spline
 * through them and samples the terrain height at every step, so the river visibly
 * steps down the terraces instead of floating at one level.
 *
 * All six were checked to be on land and clear of the markers and props; the
 * tightest is the fourth, which passes 0.05 outside Sigiriya's Lion Rock.
 */
export const MAHAWELI_POINTS: WorldPoint[] = [
  { x: 0.1, z: 1.1 }, // headwaters up in the hill country
  { x: 0.392, z: 0.948 }, // Minipe, where it leaves the highlands
  { x: 0.6, z: 0.45 },
  { x: 0.78, z: -0.02 }, // the dry-zone plain, east of Sigiriya
  { x: 0.9, z: -0.75 },
  { x: 0.99, z: -1.28 }, // the mouth at Trincomalee
];

/** Half-width of the river at its narrowest (headwaters) and widest (mouth). */
export const MAHAWELI_WIDTH = { start: 0.012, end: 0.045 };
