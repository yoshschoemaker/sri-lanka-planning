export type TripPhase = "upcoming" | "ongoing" | "completed";

export interface TripStatus {
  phase: TripPhase;
  /** Full days until departure. Meaningful when phase is "upcoming". */
  daysUntilStart: number;
  /** 1-indexed day of the trip. Meaningful when phase is "ongoing" (or "completed", where it equals totalDays). */
  currentDay: number;
  totalDays: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Derives where "now" sits relative to the trip: before it starts, during it,
 * or after it ends. Degrades gracefully instead of showing a negative or
 * out-of-range countdown once the trip is underway or over.
 */
export function getTripStatus(start: string, end: string, now: Date = new Date()): TripStatus {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  const today = startOfDay(now);

  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

  if (today < startDate) {
    const daysUntilStart = Math.round((startDate.getTime() - today.getTime()) / MS_PER_DAY);
    return { phase: "upcoming", daysUntilStart, currentDay: 0, totalDays };
  }

  if (today > endDate) {
    return { phase: "completed", daysUntilStart: 0, currentDay: totalDays, totalDays };
  }

  const currentDay = Math.round((today.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  return { phase: "ongoing", daysUntilStart: 0, currentDay, totalDays };
}
