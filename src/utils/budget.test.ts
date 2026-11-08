import { describe, expect, it } from "vitest";
import { buildBudgetOverview, formatEuro, splitDivisor } from "./budget";
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
    expect(overview.total).toBe(290);
    expect(overview.missingCount).toBe(2);
  });

  it("laat een doortocht weg, want daar wordt niet geslapen", () => {
    const overview = buildBudgetOverview([stop("a", 0, 50), stop("b", 2, 100)], { people: 4 });
    expect(overview.stays.map((line) => line.stopId)).toEqual(["b"]);
  });

  it("neemt de vliegtickets mee in het totaal", () => {
    const overview = buildBudgetOverview([stop("a", 2, 200)], { people: 4, flights: 3000 });
    expect(overview.total).toBe(3200);
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
