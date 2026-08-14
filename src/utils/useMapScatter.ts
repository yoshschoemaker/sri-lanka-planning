import { useMemo } from "react";
import { getHabitatSpecs, MIN_COAST_DISTANCE, SCATTER_SEED, type SpeciesKey } from "../data/habitats";
import type { Stop } from "../types/trip";
import { buildMapExclusions } from "./mapExclusions";
import { scatterHabitats, type ScatterItem } from "./scatter3d";
import { useDetailLevel } from "./useDetailLevel";

export type MapScatter = Record<SpeciesKey, ScatterItem[]>;

/**
 * Runs the whole island's procedural placement once and hands each species'
 * items to whichever component renders them.
 *
 * Deliberately a single call rather than one per component: the scatter's cost is
 * dominated by the per-candidate terrain and coastline lookups, and resolving all
 * species from one candidate stream pays those once instead of seven times. It
 * also means species can't collide with each other, since they share one
 * spacing grid.
 *
 * Measured around 40ms at low detail and 75ms at high on desktop, once per mount.
 * That lands inside the Suspense window of the lazily-imported map scene
 * (src/components/TripMapScene.tsx), so it isn't a visible hitch — but it is the
 * reason this is memoised on the stop list rather than recomputed per render.
 */
export function useMapScatter(stops: Stop[]): MapScatter {
  const detail = useDetailLevel();

  return useMemo(
    () =>
      scatterHabitats({
        seed: SCATTER_SEED,
        specs: getHabitatSpecs(detail),
        exclusions: buildMapExclusions(stops),
        minCoastDistance: MIN_COAST_DISTANCE,
      }),
    [stops, detail],
  );
}
