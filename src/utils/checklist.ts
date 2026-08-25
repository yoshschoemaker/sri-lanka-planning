import type { Stop, Trip } from "../types/trip";
import { isBookingSettled } from "./nights";

export interface ChecklistItem {
  key: string;
  label: string;
  detail?: string;
  stopId?: string;
}

export interface TripChecklist {
  toBook: ChecklistItem[];
  toArrange: ChecklistItem[];
  warnings: ChecklistItem[];
  questions: ChecklistItem[];
  totalCount: number;
}

/**
 * Sleutel uit de tekst zelf in plaats van uit de positie in de lijst.
 *
 * Deze keys worden opgeslagen zodra je een item afvinkt (zie
 * useChecklistProgress), en een op de index gebaseerde sleutel zou dan bij het
 * herordenen van content/trip.json het vinkje naar een ander item verhuizen.
 */
function textKey(prefix: string, text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${prefix}-${slug}`;
}

export function buildTripChecklist(
  trip: Trip,
  stops: Stop[],
  openQuestions: string[],
  todos: string[] = [],
): TripChecklist {
  const toBook: ChecklistItem[] = [
    ...(!trip.flights.outbound.booked
      ? [{ key: "flight-out", label: "Vlucht heen", detail: trip.flights.outbound.date }]
      : []),
    ...(!trip.flights.return.booked
      ? [{ key: "flight-return", label: "Vlucht terug", detail: trip.flights.return.date }]
      : []),
    ...stops
      // Een doortocht heeft geen verblijf, dus hij hoort niet in de boekingslijst.
      .filter((stop) => !isBookingSettled(stop))
      .map((stop) => ({ key: `book-${stop.id}`, label: stop.name, detail: stop.dates, stopId: stop.id })),
  ];

  // Losse regeldingen die niet aan een stop hangen (visum, verzekering, ...).
  const toArrange: ChecklistItem[] = todos.map((todo) => ({ key: textKey("todo", todo), label: todo }));

  const warnings: ChecklistItem[] = stops.flatMap((stop) => {
    const items: ChecklistItem[] = [];
    if (stop.warn) {
      items.push({ key: `warn-${stop.id}`, label: stop.warn, detail: stop.name, stopId: stop.id });
    }
    if (stop.transportTo.warn) {
      items.push({
        key: `warn-transport-${stop.id}`,
        label: stop.transportTo.warn,
        detail: `onderweg naar ${stop.name}`,
        stopId: stop.id,
      });
    }
    return items;
  });

  const questions: ChecklistItem[] = openQuestions.map((question) => ({ key: textKey("question", question), label: question }));

  return {
    toBook,
    toArrange,
    warnings,
    questions,
    totalCount: toBook.length + toArrange.length + warnings.length + questions.length,
  };
}
