import type { Stop } from "../types/trip";

export function computeNightsCheck(stops: Stop[], expected: number) {
  const total = stops.reduce((sum, stop) => sum + stop.nights, 0);
  return { total, expected, diff: total - expected, ok: total === expected };
}
