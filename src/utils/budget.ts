import type { Budget, Stop } from "../types/trip";
import { isStopover } from "./nights";

/** Hoe de Budget-tab bedragen toont. De data zelf is altijd een groepstotaal. */
export type BudgetSplit = "total" | "couple" | "person";

export interface BudgetStayLine {
  stopId: string;
  stopName: string;
  /** Naam van het verblijf, of null zolang er nog niets geboekt is. */
  accommodation: string | null;
  dates: string;
  nights: number;
  /** Groepstotaal, of null zolang de prijs onbekend is. */
  price: number | null;
}

export interface BudgetOverview {
  stays: BudgetStayLine[];
  /** Som van de bekende verblijfsprijzen. */
  staysTotal: number;
  /** Nachten waarvan de prijs bekend is; de basis voor het gemiddelde per nacht. */
  pricedNights: number;
  /** Verblijven zonder prijs. */
  staysMissing: number;
  flights: number | null;
  /** Alles wat bekend is bij elkaar. */
  total: number;
  /** Posten (verblijven plus vliegtickets) waarvan de prijs nog ontbreekt. */
  missingCount: number;
}

/**
 * Zet de stops en het budgetblok uit content/trip.json om naar wat de
 * Budget-tab toont. Onbekende prijzen tellen niet mee in de totalen maar
 * worden wel geteld, zodat de pagina kan zeggen dat het totaal nog niet af is
 * in plaats van een te laag bedrag als eindbedrag te tonen.
 */
export function buildBudgetOverview(stops: Stop[], budget: Budget): BudgetOverview {
  const stays: BudgetStayLine[] = stops
    .filter((stop) => !isStopover(stop))
    .map((stop) => ({
      stopId: stop.id,
      stopName: stop.name,
      accommodation: stop.accommodation?.name ?? null,
      dates: stop.dates,
      nights: stop.nights,
      price: stop.accommodation?.price ?? null,
    }));

  const priced = stays.filter((line) => line.price !== null);
  const staysTotal = priced.reduce((sum, line) => sum + (line.price ?? 0), 0);
  const pricedNights = priced.reduce((sum, line) => sum + line.nights, 0);
  const staysMissing = stays.length - priced.length;
  const flights = budget.flights ?? null;

  return {
    stays,
    staysTotal,
    pricedNights,
    staysMissing,
    flights,
    total: staysTotal + (flights ?? 0),
    missingCount: staysMissing + (flights === null ? 1 : 0),
  };
}

/** Waardoor een groepstotaal gedeeld wordt. Een oneven groep geeft een half stel; dat is dan ook wat een stel betaalt. */
export function splitDivisor(split: BudgetSplit, people: number): number {
  if (split === "person") return people;
  if (split === "couple") return people / 2;
  return 1;
}

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function formatEuro(amount: number): string {
  return euro.format(Math.round(amount));
}
