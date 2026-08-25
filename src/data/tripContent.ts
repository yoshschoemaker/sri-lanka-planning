import type {
  Activity,
  BookingSummary,
  Flight,
  Region,
  Stop,
  TransportMode,
  TransportModeKey,
  Trip,
} from "../types/trip";
import { addDays, daysBetween, formatDayMonthTime, formatStopDates, formatWeekdayDayMonth, toDateOnly, toTimeOnly } from "../utils/formatDate";
import rawContent from "../../content/trip.json";

/**
 * Turns content/trip.json into the shapes the app renders.
 *
 * The point of this file is that every date in the app is *derived* here. The
 * JSON holds two flight timestamps and a `nights` count per stop; check-in and
 * check-out dates, the trip's span, the night budget and the booking summary
 * all fall out of those. Insert a stop or change one night and the whole
 * itinerary re-dates itself, which is exactly the edit that used to mean
 * rewriting nine hand-typed date strings and hoping they still added up.
 *
 * Anything wrong with the JSON is caught before it ships: `pnpm validate` (also
 * run by `pnpm build`) checks the file properly, and DEV additionally warns in
 * the console. See content/README.md.
 */

/**
 * The JSON as authored, which is deliberately *not* the same shape as the
 * rendered types: no dates, no `$schema`, everything optional that has a
 * sensible default. TypeScript can't infer this usefully from a JSON import
 * (it widens each stop into its own literal type), so it's declared here and
 * the import is cast to it once.
 */
interface RawContent {
  title: string;
  flights: { outbound: RawFlight; return: RawFlight };
  transportModes: Record<string, TransportMode>;
  regions?: Region[];
  stops: RawStop[];
  notes?: string[];
  openQuestions?: string[];
  todos?: string[];
}

type RawFlight = Omit<Flight, "date" | "depart" | "arrive" | "booked"> & { booked?: boolean };

export type RawStop = Omit<Stop, "dates" | "startDate" | "endDate" | "booked" | "note" | "activities"> & {
  booked?: boolean;
  note?: string;
  activities?: Activity[];
};

const content = rawContent as unknown as RawContent;

function resolveFlight(flight: RawFlight): Flight {
  return {
    ...flight,
    booked: flight.booked ?? false,
    date: formatWeekdayDayMonth(toDateOnly(flight.departAt)),
    depart: toTimeOnly(flight.departAt),
    arrive: formatDayMonthTime(flight.arriveAt),
  };
}

const outbound = resolveFlight(content.flights.outbound);
const returnFlight = resolveFlight(content.flights.return);

/** Day 1 on the island, and therefore the first stop's check-in. */
const itineraryStart = toDateOnly(outbound.arriveAt);

/**
 * Walks the route once, handing each stop the day the previous one checked out
 * of. A stopover (0 nights) checks out the same day it arrives, so it takes a
 * day of the trip without taking a night out of the budget — which is exactly
 * what a "we stop, do the safari, drive on" day is.
 *
 * Exported (and taking its start date as an argument) purely so it can be
 * tested against synthetic stops: asserting on the real trip.json would mean
 * rewriting the test every time the plan changes.
 */
export function resolveStops(rawStops: RawStop[], startsOn: string): Stop[] {
  let cursor = startsOn;
  return rawStops.map((raw) => {
    const startDate = cursor;
    const endDate = addDays(startDate, raw.nights);
    cursor = endDate;
    return {
      ...raw,
      booked: raw.booked ?? false,
      note: raw.note ?? "",
      activities: raw.activities ?? [],
      startDate,
      endDate,
      dates: formatStopDates(startDate, endDate),
    };
  });
}

export const stops: Stop[] = resolveStops(content.stops, itineraryStart);

export const transportModes: Record<TransportModeKey, TransportMode> = content.transportModes;

export const regions: Region[] = content.regions ?? [];

const regionsById = new Map(regions.map((region) => [region.id, region]));

/** The region a stop sits under, or undefined for a stop that belongs to no heading. */
export function getRegion(id: string | undefined): Region | undefined {
  return id ? regionsById.get(id) : undefined;
}

/** First stop of a region, used as the anchor for the "spring naar" buttons. */
export function getRegionAnchorStop(regionId: string): Stop | undefined {
  return stops.find((stop) => stop.region === regionId);
}

export const notes: string[] = content.notes ?? [];
export const openQuestions: string[] = content.openQuestions ?? [];
export const todos: string[] = content.todos ?? [];

/**
 * Wat er al staat en wat er nog open is, in één regel elk.
 *
 * Takes its flights and stops as arguments (rather than closing over the
 * module's own) so it can be tested against synthetic input, the same reason
 * resolveStops does.
 */
export function buildBookingSummary(flights: Trip["flights"], allStops: Stop[]): BookingSummary {
  const { outbound: out, return: back } = flights;
  const bookedFlights = out.booked && back.booked ? "vluchten" : out.booked ? "vlucht heen" : back.booked ? "vlucht terug" : null;

  // A stopover needs no room, so it is never part of the booking counts.
  const stays = allStops.filter((stop) => stop.nights > 0);

  const bookedStays = stays
    .filter((stop) => stop.booked)
    .map((stop) => (stop.accommodation ? `${stop.name} (${stop.accommodation.name})` : stop.name));

  const booked = [bookedFlights, ...bookedStays].filter(Boolean).join(" + ");
  const openCount = stays.length - bookedStays.length;

  return {
    booked: booked || "nog niets",
    toBook: `${openCount} ${openCount === 1 ? "verblijf" : "verblijven"}`,
  };
}

export const trip: Trip = {
  title: content.title,
  start: toDateOnly(outbound.departAt),
  end: toDateOnly(returnFlight.arriveAt),
  itineraryStart,
  // Nights the flights leave room for: from landing to the morning the return
  // flight leaves. What the stops actually plan is their `nights` summed —
  // computeNightsCheck compares the two so a gap is visible instead of silent.
  totalNights: daysBetween(itineraryStart, toDateOnly(returnFlight.departAt)),
  flights: { outbound, return: returnFlight },
  bookingSummary: buildBookingSummary({ outbound, return: returnFlight }, stops),
};

if (import.meta.env.DEV) {
  const problems: string[] = [];
  const seenStopIds = new Set<string>();
  const seenActivityIds = new Set<string>();
  const regionIds = new Set(regions.map((region) => region.id));

  for (const stop of stops) {
    if (seenStopIds.has(stop.id)) problems.push(`Dubbele stop-id: "${stop.id}"`);
    seenStopIds.add(stop.id);

    if (!(stop.transportTo.mode in transportModes)) {
      problems.push(`Stop "${stop.id}" gebruikt onbekende vervoerssoort "${stop.transportTo.mode}"`);
    }
    if (stop.region && !regionIds.has(stop.region)) {
      problems.push(`Stop "${stop.id}" verwijst naar onbekende regio "${stop.region}"`);
    }

    for (const activity of stop.activities) {
      if (seenActivityIds.has(activity.id)) problems.push(`Dubbele activiteit-id: "${activity.id}"`);
      seenActivityIds.add(activity.id);
      if (activity.daytrip && (activity.lat == null || activity.lon == null)) {
        problems.push(`Dagtrip "${activity.id}" mist lat/lon`);
      }
    }
  }

  const plannedNights = stops.reduce((sum, stop) => sum + stop.nights, 0);
  if (plannedNights !== trip.totalNights) {
    problems.push(
      `De stops plannen ${plannedNights} nachten, de vluchten laten ruimte voor ${trip.totalNights}. ` +
        `Laatste vertrek is ${stops[stops.length - 1]?.endDate}, de terugvlucht gaat ${toDateOnly(returnFlight.departAt)}.`,
    );
  }

  for (const problem of problems) console.warn(`[content] ${problem}`);
}
