import type { BookingDetails, Budget, BudgetExtra, Stop } from "../types/trip";
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
  url?: string;
  booking?: BookingDetails;
  /** Eerste foto van het verblijf, voor het duimnageltje. */
  photo?: string;
  /**
   * Schatting voor een verblijf zonder prijs: het gemiddelde per nacht van de
   * verblijven mét prijs, keer de nachten van dit verblijf. Null als de prijs
   * bekend is (of er nog niets is om een gemiddelde uit te halen).
   */
  estimate: number | null;
}

export interface BudgetExtraLine {
  label: string;
  /** Groepstotaal, of null zolang onbekend. */
  amount: number | null;
  estimate: boolean;
  note?: string;
  booking?: BookingDetails;
}

/** Een extra post als groepstotaal: `amount` als die er is, anders `perPerson` keer het aantal reizigers. */
export function resolveExtra(extra: BudgetExtra, people: number): BudgetExtraLine {
  const amount = extra.amount ?? (extra.perPerson != null ? extra.perPerson * people : null);
  return { label: extra.label, amount, estimate: extra.estimate ?? false, note: extra.note, booking: extra.booking };
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
  extras: BudgetExtraLine[];
  extrasTotal: number;
  /** Of er schattingen in het totaal zitten. */
  hasEstimates: boolean;
  /** Alles met een vaste prijs: verblijven, vliegtickets en extra posten die geen schatting zijn. */
  confirmedTotal: number;
  /** Schattingen: extra posten met estimate, plus verblijven zonder prijs (gemiddelde per nacht). */
  estimatedTotal: number;
  /** Vaste prijzen die nog niet betaald zijn. */
  openTotal: number;
  /** Wat de reis naar verwachting in totaal kost: vast plus schattingen. Gelijk aan betaald + open + schattingen. */
  forecastTotal: number;
  /** Posten zonder prijs én zonder schatting; die tellen nergens mee. */
  missingCount: number;
  /** Wat er volgens de boekingsgegevens al betaald is. */
  paidTotal: number;
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
      url: stop.accommodation?.url,
      booking: stop.accommodation?.booking,
      photo: stop.accommodation?.photos?.[0],
      estimate: null as number | null,
    }));

  const priced = stays.filter((line) => line.price !== null);
  const staysTotal = priced.reduce((sum, line) => sum + (line.price ?? 0), 0);
  const pricedNights = priced.reduce((sum, line) => sum + line.nights, 0);
  const staysMissing = stays.length - priced.length;
  const flights = budget.flights ?? null;
  const extras = (budget.extras ?? []).map((extra) => resolveExtra(extra, budget.people));
  const extrasTotal = extras.reduce((sum, line) => sum + (line.amount ?? 0), 0);

  const averagePerNight = pricedNights > 0 ? staysTotal / pricedNights : null;
  for (const line of stays) {
    if (line.price === null && averagePerNight !== null) line.estimate = averagePerNight * line.nights;
  }
  const staysEstimate = stays.reduce((sum, line) => sum + (line.estimate ?? 0), 0);

  const extrasFixed = extras.filter((line) => !line.estimate).reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const extrasEstimate = extras.filter((line) => line.estimate).reduce((sum, line) => sum + (line.amount ?? 0), 0);

  const confirmedTotal = staysTotal + (flights ?? 0) + extrasFixed;
  const estimatedTotal = extrasEstimate + staysEstimate;
  const paidTotal =
    stays.reduce((sum, line) => sum + paidAmount(line.price, line.booking), 0) +
    paidAmount(flights, budget.flightBooking) +
    extras.reduce((sum, line) => sum + paidAmount(line.estimate ? null : line.amount, line.booking), 0);

  return {
    stays,
    staysTotal,
    pricedNights,
    staysMissing,
    flights,
    extras,
    extrasTotal,
    hasEstimates: estimatedTotal > 0,
    confirmedTotal,
    estimatedTotal,
    paidTotal,
    openTotal: confirmedTotal - paidTotal,
    forecastTotal: confirmedTotal + estimatedTotal,
    // Alleen wat ook geen schatting heeft: dat telt echt nergens mee.
    missingCount:
      stays.filter((line) => line.price === null && line.estimate === null).length +
      (flights === null ? 1 : 0) +
      extras.filter((line) => line.amount === null).length,
  };
}

/** Hoeveel er van een post betaald is. Zonder prijs of status telt hij als niet betaald. */
export function paidAmount(price: number | null, booking: BookingDetails | undefined): number {
  if (price === null || !booking?.payment) return 0;
  if (booking.payment === "paid") return price;
  if (booking.payment === "partial") return Math.min(booking.paidAmount ?? 0, price);
  return 0;
}

/** Het platform zoals ingevuld, anders afgeleid uit de boekingslink. */
export function platformOf(booking: BookingDetails | undefined, url: string | undefined): string | null {
  if (booking?.platform) return booking.platform;
  if (!url) return null;
  if (/airbnb\./i.test(url)) return "Airbnb";
  if (/booking\.com/i.test(url)) return "Booking.com";
  if (/agoda\./i.test(url)) return "Agoda";
  return null;
}

export type CancellationStatus =
  | { kind: "anytime" }
  | { kind: "free"; until: string }
  | { kind: "expired"; until: string }
  | { kind: "none" }
  | { kind: "unknown" };

/** Of je nog gratis kunt annuleren, gezien vanaf `today` (YYYY-MM-DD). */
export function cancellationStatus(booking: BookingDetails | undefined, today: string): CancellationStatus {
  if (booking?.nonRefundable) return { kind: "none" };
  if (booking?.cancelAnytime) return { kind: "anytime" };
  if (!booking?.cancelUntil) return { kind: "unknown" };
  return booking.cancelUntil >= today
    ? { kind: "free", until: booking.cancelUntil }
    : { kind: "expired", until: booking.cancelUntil };
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
