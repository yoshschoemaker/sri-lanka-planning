import { describe, expect, it } from "vitest";
import { buildBookingSummary, resolveStops, stops, transportModes, trip, type RawStop } from "./tripContent";
import type { Flight, Stop } from "../types/trip";

/** Minimale ruwe stop; alleen de velden die resolveStops leest doen mee. */
function raw(id: string, nights: number, extra: Partial<RawStop> = {}): RawStop {
  return { id, name: id, nights, lat: 0, lon: 0, transportTo: { mode: "car", label: "", duration: "" }, ...extra } as RawStop;
}

function flight(booked: boolean): Flight {
  return { booked } as Flight;
}

function stay(name: string, nights: number, booked: boolean, accommodation?: string): Stop {
  return { name, nights, booked, accommodation: accommodation ? { name: accommodation } : undefined } as Stop;
}

describe("resolveStops", () => {
  it("laat elke stop inchecken op de dag dat de vorige uitcheckt", () => {
    const result = resolveStops([raw("a", 2), raw("b", 3)], "2027-01-26");
    expect(result[0]).toMatchObject({ startDate: "2027-01-26", endDate: "2027-01-28" });
    expect(result[1]).toMatchObject({ startDate: "2027-01-28", endDate: "2027-01-31" });
  });

  it("laat een doortocht dezelfde dag uitchecken als hij aankomt", () => {
    const result = resolveStops([raw("a", 2), raw("stopover", 0), raw("b", 1)], "2027-02-05");
    expect(result[1]).toMatchObject({ startDate: "2027-02-07", endDate: "2027-02-07" });
    // De doortocht kost een dag maar geen nacht, dus de volgende stop begint
    // op diezelfde dag.
    expect(result[2].startDate).toBe("2027-02-07");
  });

  it("schrijft de datums van een doortocht als één dag", () => {
    const result = resolveStops([raw("stopover", 0)], "2027-02-07");
    expect(result[0].dates).toBe("zo 7 feb");
  });

  it("rekent over een maandgrens door", () => {
    const result = resolveStops([raw("a", 5)], "2027-01-29");
    expect(result[0].endDate).toBe("2027-02-03");
    expect(result[0].dates).toBe("vr 29 jan tot wo 3 feb");
  });

  it("vult de weggelaten velden met hun standaardwaarde", () => {
    const [only] = resolveStops([raw("a", 1)], "2027-01-26");
    expect(only.booked).toBe(false);
    expect(only.note).toBe("");
    expect(only.activities).toEqual([]);
  });

  it("laat opgegeven waarden staan", () => {
    const [only] = resolveStops([raw("a", 1, { booked: true, note: "let op" })], "2027-01-26");
    expect(only.booked).toBe(true);
    expect(only.note).toBe("let op");
  });

  it("levert een lege lijst voor een lege route", () => {
    expect(resolveStops([], "2027-01-26")).toEqual([]);
  });
});

describe("buildBookingSummary", () => {
  const geenVluchten = { outbound: flight(false), return: flight(false) };

  it("zegt 'nog niets' als er niets geboekt is", () => {
    const summary = buildBookingSummary(geenVluchten, [stay("Kandy", 2, false)]);
    expect(summary.booked).toBe("nog niets");
  });

  it("noemt beide vluchten samen als ze allebei geboekt zijn", () => {
    const summary = buildBookingSummary({ outbound: flight(true), return: flight(true) }, []);
    expect(summary.booked).toBe("vluchten");
  });

  it("noemt alleen de heenvlucht als die als enige geboekt is", () => {
    const summary = buildBookingSummary({ outbound: flight(true), return: flight(false) }, []);
    expect(summary.booked).toBe("vlucht heen");
  });

  it("zet de naam van het verblijf tussen haakjes achter de plaats", () => {
    const summary = buildBookingSummary(geenVluchten, [stay("Negombo", 1, true, "The Beach Apartments")]);
    expect(summary.booked).toBe("Negombo (The Beach Apartments)");
  });

  it("noemt alleen de plaats als er nog geen verblijf gekozen is", () => {
    const summary = buildBookingSummary(geenVluchten, [stay("Ella", 2, true)]);
    expect(summary.booked).toBe("Ella");
  });

  it("telt alleen verblijven met nachten als nog te boeken", () => {
    const summary = buildBookingSummary(geenVluchten, [stay("Yala", 0, false), stay("Kandy", 2, false)]);
    expect(summary.toBook).toBe("1 verblijf");
  });

  it("gebruikt meervoud vanaf twee openstaande verblijven", () => {
    const summary = buildBookingSummary(geenVluchten, [stay("Kandy", 2, false), stay("Ella", 2, false)]);
    expect(summary.toBook).toBe("2 verblijven");
  });

  it("houdt 0 openstaand over als alles geboekt is", () => {
    const summary = buildBookingSummary(geenVluchten, [stay("Kandy", 2, true)]);
    expect(summary.toBook).toBe("0 verblijven");
  });
});

describe("de echte inhoud van content/trip.json", () => {
  it("plant precies de nachten waar de vluchten ruimte voor laten", () => {
    const planned = stops.reduce((sum, stop) => sum + stop.nights, 0);
    expect(planned).toBe(trip.totalNights);
  });

  it("laat de route aansluiten op de landingsdag", () => {
    expect(stops[0].startDate).toBe(trip.itineraryStart);
  });

  it("laat elke stop naadloos op de vorige volgen", () => {
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].startDate).toBe(stops[i - 1].endDate);
    }
  });

  it("gebruikt uitsluitend vervoerssoorten die trip.json ook definieert", () => {
    for (const stop of stops) {
      expect(transportModes, `stop "${stop.id}"`).toHaveProperty(stop.transportTo.mode);
    }
  });

  it("heeft geen dubbele stop-id's", () => {
    const ids = stops.map((stop) => stop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("heeft geen dubbele activiteit-id's over alle stops heen", () => {
    const ids = stops.flatMap((stop) => stop.activities.map((activity) => activity.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("geeft elke dagtrip een plek op de kaart", () => {
    for (const stop of stops) {
      for (const activity of stop.activities.filter((a) => a.daytrip)) {
        expect(activity.lat, `${activity.id} mist lat`).toBeTypeOf("number");
        expect(activity.lon, `${activity.id} mist lon`).toBeTypeOf("number");
      }
    }
  });
});
