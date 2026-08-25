import type { Stop } from "../types/trip";

/** Vandaag als "2027-02-07" in de plaatselijke tijd, zodat het vergelijkbaar is met de datums van een stop. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Of een stop "vandaag" is.
 *
 * De datums van een stop zijn check-in tot check-out, en die check-out valt
 * samen met de check-in van de volgende. Zonder regel zou elke overgangsdag dus
 * twee stops tegelijk als vandaag aanwijzen. Daarom:
 *
 * - een verblijf loopt van check-in tot en met de nacht ervoor, dus [start, eind);
 * - de laatste stop pakt zijn einddatum er wél bij, want dat is de dag dat je
 *   naar het vliegveld gaat en niet ergens anders naartoe verhuist;
 * - een doortocht (0 nachten) valt op precies één dag.
 *
 * Op een doortocht-dag geeft dit bewust twee treffers: je doet die dag de
 * safari én je komt aan waar je slaapt. Dat is geen fout, dat is die dag.
 */
export function isCurrentStop(stop: Stop, today: string, isLast: boolean): boolean {
  if (stop.nights === 0) return today === stop.startDate;
  if (isLast) return today >= stop.startDate && today <= stop.endDate;
  return today >= stop.startDate && today < stop.endDate;
}

/** De id's van alle stops die vandaag zijn, in routevolgorde. */
export function currentStopIds(stops: Stop[], today: string): string[] {
  return stops.filter((stop, i) => isCurrentStop(stop, today, i === stops.length - 1)).map((stop) => stop.id);
}

/**
 * Waar de lijst naartoe moet springen als je de app onderweg opent. De eerste
 * treffer, want op een doortocht-dag is dat wat je die dag daadwerkelijk doet.
 */
export function currentStopId(stops: Stop[], today: string): string | null {
  return currentStopIds(stops, today)[0] ?? null;
}
