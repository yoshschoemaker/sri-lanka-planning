import { useCallback, useState } from "react";

/** Versie in de sleutel, zoals bij de Gids: verandert de vorm, dan begint iedereen schoon. */
const STORAGE_KEY = "srilanka-trip:tuktuk:v1";

export interface TuktukRecord {
  best: number;
  distance: number;
  reachedStop: string | null;
  games: number;
}

const EMPTY: TuktukRecord = { best: 0, distance: 0, reachedStop: null, games: 0 };

export function loadTuktukRecord(): TuktukRecord {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<TuktukRecord>;
    const number = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    return {
      best: number(parsed.best),
      distance: number(parsed.distance),
      reachedStop: typeof parsed.reachedStop === "string" ? parsed.reachedStop : null,
      games: number(parsed.games),
    };
  } catch {
    return EMPTY;
  }
}

function saveTuktukRecord(record: TuktukRecord): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Geen opslag: dan telt het record alleen deze sessie.
  }
}

/** Telt een gereden rit mee en houdt de beste bij. */
export function withRide(record: TuktukRecord, ride: { score: number; distance: number; reachedStop: string | null }): TuktukRecord {
  const games = record.games + 1;
  if (ride.score <= record.best) return { ...record, games };
  return { best: ride.score, distance: ride.distance, reachedStop: ride.reachedStop, games };
}

export function useTuktukRecord() {
  const [record, setRecord] = useState<TuktukRecord>(loadTuktukRecord);

  const addRide = useCallback((ride: { score: number; distance: number; reachedStop: string | null }) => {
    setRecord((current) => {
      const next = withRide(current, ride);
      saveTuktukRecord(next);
      return next;
    });
  }, []);

  return { record, addRide };
}
