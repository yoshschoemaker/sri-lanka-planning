import { describe, expect, it } from "vitest";
import { buildBudgetOverview, cancellationStatus, resolveExtra, formatEuro, paidAmount, platformOf, splitDivisor } from "./budget";
import type { Stop } from "../types/trip";

function stop(id: string, nights: number, price?: number, name = `Verblijf ${id}`): Stop {
  return {
    id,
    name: id,
    nights,
    dates: "",
    accommodation: price === undefined && name === "" ? undefined : { name, price },
  } as Stop;
}

describe("buildBudgetOverview", () => {
  it("telt alleen bekende prijzen op en houdt bij wat ontbreekt", () => {
    const overview = buildBudgetOverview([stop("a", 2, 200), stop("b", 3), stop("c", 1, 90)], { people: 4 });
    expect(overview.staysTotal).toBe(290);
    expect(overview.pricedNights).toBe(3);
    expect(overview.staysMissing).toBe(1);
    expect(overview.flights).toBeNull();
    expect(overview.confirmedTotal).toBe(290);
    // Verblijf b krijgt een schatting, dus alleen de vliegtickets ontbreken echt.
    expect(overview.missingCount).toBe(1);
  });

  it("laat een doortocht weg, want daar wordt niet geslapen", () => {
    const overview = buildBudgetOverview([stop("a", 0, 50), stop("b", 2, 100)], { people: 4 });
    expect(overview.stays.map((line) => line.stopId)).toEqual(["b"]);
  });

  it("neemt de vliegtickets mee in het totaal", () => {
    const overview = buildBudgetOverview([stop("a", 2, 200)], { people: 4, flights: 3000 });
    expect(overview.confirmedTotal).toBe(3200);
    expect(overview.missingCount).toBe(0);
  });

  it("toont een verblijf zonder accommodatie als nog niet geboekt", () => {
    const overview = buildBudgetOverview([stop("a", 2, undefined, "")], { people: 4 });
    expect(overview.stays[0].accommodation).toBeNull();
    expect(overview.stays[0].price).toBeNull();
  });
});

describe("splitDivisor", () => {
  it("deelt per stel door de helft van de groep en per persoon door de hele groep", () => {
    expect(splitDivisor("total", 4)).toBe(1);
    expect(splitDivisor("couple", 4)).toBe(2);
    expect(splitDivisor("person", 4)).toBe(4);
  });
});

describe("formatEuro", () => {
  it("rondt af op hele euro's", () => {
    expect(formatEuro(1234.6).replace(/\s/g, " ")).toBe("€ 1.235");
  });
});

describe("paidAmount", () => {
  it("telt volledig, deels en niet betaald", () => {
    expect(paidAmount(300, { payment: "paid" })).toBe(300);
    expect(paidAmount(300, { payment: "partial", paidAmount: 100 })).toBe(100);
    expect(paidAmount(300, { payment: "unpaid" })).toBe(0);
    expect(paidAmount(null, { payment: "paid" })).toBe(0);
    expect(paidAmount(300, undefined)).toBe(0);
  });

  it("telt een deelbetaling nooit hoger dan de prijs", () => {
    expect(paidAmount(300, { payment: "partial", paidAmount: 500 })).toBe(300);
  });

  it("neemt de vliegtickets mee in wat al betaald is", () => {
    const overview = buildBudgetOverview([stop("a", 2, 200)], { people: 4, flights: 3000, flightBooking: { payment: "paid" } });
    expect(overview.paidTotal).toBe(3000);
  });
});

describe("platformOf", () => {
  it("gebruikt het ingevulde platform, anders de link", () => {
    expect(platformOf({ platform: "Agoda" }, "https://www.airbnb.nl/rooms/1")).toBe("Agoda");
    expect(platformOf(undefined, "https://www.airbnb.nl/rooms/1")).toBe("Airbnb");
    expect(platformOf(undefined, "https://www.booking.com/hotel/lk/x.html")).toBe("Booking.com");
    expect(platformOf(undefined, undefined)).toBeNull();
  });
});

describe("cancellationStatus", () => {
  it("is gratis tot en met de laatste dag, daarna verlopen", () => {
    expect(cancellationStatus({ cancelUntil: "2027-01-10" }, "2027-01-10")).toEqual({ kind: "free", until: "2027-01-10" });
    expect(cancellationStatus({ cancelUntil: "2027-01-10" }, "2027-01-11")).toEqual({ kind: "expired", until: "2027-01-10" });
  });

  it("kent niet-annuleerbaar en onbekend", () => {
    expect(cancellationStatus({ nonRefundable: true, cancelUntil: "2027-01-10" }, "2026-12-01")).toEqual({ kind: "none" });
    expect(cancellationStatus({}, "2026-12-01")).toEqual({ kind: "unknown" });
  });
});

describe("extra posten", () => {
  it("rekent een bedrag per persoon om naar een groepstotaal", () => {
    expect(resolveExtra({ label: "Trein", perPerson: 10 }, 4).amount).toBe(40);
    expect(resolveExtra({ label: "Tuktuk", amount: 1220 }, 4).amount).toBe(1220);
    expect(resolveExtra({ label: "Iets" }, 4).amount).toBeNull();
  });

  it("telt extra posten mee in het totaal en meldt schattingen", () => {
    const overview = buildBudgetOverview([stop("a", 2, 200)], {
      people: 4,
      extras: [{ label: "Tuktuk", amount: 1220, estimate: true }, { label: "Onbekend" }],
    });
    expect(overview.extrasTotal).toBe(1220);
    expect(overview.confirmedTotal).toBe(200);
    expect(overview.estimatedTotal).toBe(1220);
    expect(overview.forecastTotal).toBe(1420);
    expect(overview.hasEstimates).toBe(true);
    expect(overview.missingCount).toBe(2);
  });
});

describe("cancellationStatus, altijd gratis", () => {
  it("gaat voor op een datum", () => {
    expect(cancellationStatus({ cancelAnytime: true, cancelUntil: "2027-01-01" }, "2027-02-01")).toEqual({ kind: "anytime" });
  });
});

describe("prognose", () => {
  it("schat een verblijf zonder prijs met het gemiddelde per nacht", () => {
    // 300 voor 3 nachten = 100 per nacht; het onbekende verblijf van 2 nachten wordt 200.
    const overview = buildBudgetOverview([stop("a", 3, 300), stop("b", 2)], { people: 4 });
    expect(overview.stays[1].estimate).toBe(200);
    expect(overview.stays[0].estimate).toBeNull();
    expect(overview.estimatedTotal).toBe(200);
    expect(overview.forecastTotal).toBe(500);
  });

  it("splitst de prognose in betaald, open en schatting", () => {
    const overview = buildBudgetOverview(
      [stop("a", 2, 200), stop("b", 2, 100), stop("c", 1)],
      { people: 4, flights: 1000, flightBooking: { payment: "paid" }, extras: [{ label: "Tuktuk", amount: 50, estimate: true }] },
    );
    // stop("a") en ("b") hebben geen betaalstatus, dus open.
    expect(overview.paidTotal).toBe(1000);
    expect(overview.openTotal).toBe(300);
    expect(overview.estimatedTotal).toBe(75 + 50);
    expect(overview.paidTotal + overview.openTotal + overview.estimatedTotal).toBe(overview.forecastTotal);
  });

  it("telt een geschatte extra post niet als betaald", () => {
    const overview = buildBudgetOverview([], {
      people: 4,
      extras: [{ label: "Tuktuk", amount: 100, estimate: true, booking: { payment: "paid" } }],
    });
    expect(overview.paidTotal).toBe(0);
  });
});
