import type { Stop, Trip } from "../types/trip";

export interface ChecklistItem {
  key: string;
  label: string;
  detail?: string;
  stopId?: string;
}

export interface TripChecklist {
  toBook: ChecklistItem[];
  warnings: ChecklistItem[];
  questions: ChecklistItem[];
  totalCount: number;
}

export function buildTripChecklist(trip: Trip, stops: Stop[], openQuestions: string[]): TripChecklist {
  const toBook: ChecklistItem[] = [
    ...(!trip.flights.outbound.booked
      ? [{ key: "flight-out", label: "Vlucht heen", detail: trip.flights.outbound.date }]
      : []),
    ...(!trip.flights.return.booked
      ? [{ key: "flight-return", label: "Vlucht terug", detail: trip.flights.return.date }]
      : []),
    ...stops
      .filter((stop) => !stop.booked)
      .map((stop) => ({ key: `book-${stop.id}`, label: stop.name, detail: stop.dates, stopId: stop.id })),
  ];

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

  const questions: ChecklistItem[] = openQuestions.map((question, i) => ({ key: `question-${i}`, label: question }));

  return { toBook, warnings, questions, totalCount: toBook.length + warnings.length + questions.length };
}
