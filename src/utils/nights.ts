import type { Stop } from "../types/trip";

export function computeNightsCheck(stops: Stop[], expected: number) {
  const total = stops.reduce((sum, stop) => sum + stop.nights, 0);
  return { total, expected, diff: total - expected, ok: total === expected };
}

/**
 * Een stop met 0 nachten is een doortocht: we stoppen onderweg, doen iets
 * (Yala: safari) en rijden dezelfde dag door. Hij hoort wel in de route en op
 * de kaart, maar heeft geen verblijf.
 */
export function isStopover(stop: Pick<Stop, "nights">): boolean {
  return stop.nights === 0;
}

/** Eén formulering voor de duur van een stop, overal waar hij getoond wordt. */
export function nightsLabel(stop: Pick<Stop, "nights">): string {
  if (isStopover(stop)) return "geen overnachting";
  return `${stop.nights} ${stop.nights === 1 ? "nacht" : "nachten"}`;
}

/** Een doortocht vraagt geen kamer, dus het "nog te boeken"-filter beschouwt hem als afgerond. */
export function isBookingSettled(stop: Pick<Stop, "booked" | "nights">): boolean {
  return stop.booked || isStopover(stop);
}
