import type { DetailLevel } from "../utils/useDetailLevel";
import type { HabitatSpec } from "../utils/scatter3d";

/**
 * Which procedurally scattered species grows where, and how many of it. Kept as
 * data (rather than inline in the components that render each one) because the
 * scatter resolves every species in one shared pass — see
 * src/utils/scatter3d.ts — so the specs have to be handed over together, in
 * priority order.
 *
 * The habitat predicates are real: Sri Lanka's dry zone is thorn scrub and
 * palmyra, its wet southwest is broadleaf rainforest, the mid hills are tea, and
 * the very top is treeless montane grassland (patana). getWetness and the
 * terrain tier index are what make that come out of the data instead of being
 * hand-painted.
 */
export type SpeciesKey = "grass" | "tea" | "palm" | "tree" | "scrub" | "boulder" | "paddy";

/**
 * Per-species instance counts at each detail level. Every number here was
 * checked against the actual scatter yield: a habitat that physically can't fit
 * its requested count at its spacing silently gets fewer items, which reads as
 * a sparser zone for no visible reason. These all fill (tree at "high" lands
 * a sparser zone for no visible reason. At the densities below every species
 * fills its target exactly, at both detail levels.
 *
 * Raised roughly 75% from a first pass that was visibly too thin, together with
 * tighter spacing — a denser island was the point, and the spacing is what stops
 * "denser" from becoming "cluttered": plants get closer together but never
 * interpenetrate.
 */
const COUNTS: Record<SpeciesKey, Record<DetailLevel, number>> = {
  grass: { low: 95, high: 150 },
  tea: { low: 90, high: 155 },
  palm: { low: 65, high: 125 },
  paddy: { low: 60, high: 115 },
  tree: { low: 165, high: 285 },
  boulder: { low: 45, high: 85 },
  scrub: { low: 125, high: 235 },
};

/**
 * The mid-elevation band real tea estates sit on (~800m), as a tier index into
 * TERRAIN_BANDS' thresholds [150, 300, 450, 600, 800, 1000, 1300]. Highlands.tsx
 * derives the same band from the threshold value for its own PLATEAU_LAYER1_TOP.
 */
const TEA_TIER_MIN = 3;
const TEA_TIER_MAX = 5;
/**
 * Above this, hill country is exposed patana grassland rather than forest.
 *
 * Real patana starts around 1800m (Horton Plains), well above the 1300m the
 * terrain data's top band traces — so the top tier stands in for the montane zone
 * rather than matching its true elevation. An earlier value of 5 (1000m) was
 * plainly wrong: that height in Sri Lanka is still tea and cloud forest, not
 * grassland.
 */
const PATANA_TIER_MIN = 6;

/** How close to the sea coconut palms cluster, and how far in from the coastline anything at all may stand. */
const COAST_STRIP_MAX = 0.28;

/**
 * Ordered narrowest-habitat-first: the shared scatter hands each candidate to the
 * first species that accepts it, so a broad predicate placed early would eat the
 * candidates a narrow one needs. Grass and tea are confined to a few tiers, palms
 * to a thin coastal strip, paddy to wet lowlands; tree and scrub are the broad
 * fallbacks and go last.
 */
export function getHabitatSpecs(detail: DetailLevel): HabitatSpec<SpeciesKey>[] {
  const count = (key: SpeciesKey) => COUNTS[key][detail];

  return [
    {
      key: "grass",
      count: count("grass"),
      minSpacing: 0.027,
      scaleRange: [0.7, 1.4],
      accept: ({ tier }) => tier >= PATANA_TIER_MIN,
    },
    {
      key: "tea",
      count: count("tea"),
      minSpacing: 0.034,
      scaleRange: [0.8, 1.2],
      accept: ({ tier }) => tier >= TEA_TIER_MIN && tier <= TEA_TIER_MAX,
    },
    {
      key: "palm",
      count: count("palm"),
      minSpacing: 0.085,
      scaleRange: [0.8, 1.25],
      accept: ({ coastDistance, tier }) => tier < 0 && coastDistance <= COAST_STRIP_MAX,
    },
    {
      key: "paddy",
      count: count("paddy"),
      minSpacing: 0.105,
      // Lowlands and the first terrace, inland of the beach — but in *both*
      // climate zones. An earlier version restricted paddy to the wet zone, which
      // is backwards: the dry zone is Sri Lanka's rice bowl, and the reason the
      // ancient tanks in src/data/inlandWater.ts exist at all is to irrigate it.
      accept: ({ tier, coastDistance }) => tier <= 0 && coastDistance > COAST_STRIP_MAX,
      scaleRange: [0.85, 1.3],
    },
    {
      key: "tree",
      count: count("tree"),
      minSpacing: 0.058,
      // Broadleaf forest: the wet southwest and the wetter mid slopes, but not
      // the exposed tops (patana) and not on the beach.
      accept: ({ tier, wetness, coastDistance }) =>
        wetness > 0.5 && tier < PATANA_TIER_MIN && coastDistance > COAST_STRIP_MAX * 0.6,
      scaleRange: [0.75, 1.35],
    },
    {
      key: "boulder",
      count: count("boulder"),
      minSpacing: 0.1,
      // The dry zone's granite inselbergs (the same geology as Sigiriya and
      // Pidurangala), plus a scattering along the escarpment's terrace edges.
      accept: ({ tier, wetness }) => wetness < 0.45 || tier >= TEA_TIER_MAX,
      scaleRange: [0.6, 1.5],
    },
    {
      key: "scrub",
      count: count("scrub"),
      minSpacing: 0.062,
      // Dry-zone thorn scrub: the broad fallback across the whole north and east.
      accept: ({ tier, wetness }) => wetness < 0.55 && tier < TEA_TIER_MIN,
      scaleRange: [0.7, 1.4],
    },
  ];
}

/** Seed for the whole map's scatter. Any fixed value works; this one is just the trip's year. */
export const SCATTER_SEED = 2026;

/**
 * Keeps every scattered item off the island's beveled cut edge. Raised from a
 * first pass at 0.045, where coastal palms were visibly overhanging the water: the
 * margin has to clear the *crown's* half-width, not just the trunk.
 */
export const MIN_COAST_DISTANCE = 0.07;
