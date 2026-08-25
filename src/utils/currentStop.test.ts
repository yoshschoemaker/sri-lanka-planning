import { describe, expect, it } from "vitest";
import { currentStopId, currentStopIds, isCurrentStop, todayIso } from "./currentStop";
import type { Stop } from "../types/trip";

function stop(id: string, startDate: string, endDate: string, nights: number): Stop {
  return { id, name: id, startDate, endDate, nights } as Stop;
}

/** Negombo 26-27, Kandy 27-30, Yala als doortocht op 30, Ella 30 - 2 feb. */
const route = [
  stop("negombo", "2027-01-26", "2027-01-27", 1),
  stop("kandy", "2027-01-27", "2027-01-30", 3),
  stop("yala", "2027-01-30", "2027-01-30", 0),
  stop("ella", "2027-01-30", "2027-02-02", 3),
];

describe("todayIso", () => {
  it("schrijft de plaatselijke datum met voorloopnullen", () => {
    expect(todayIso(new Date("2027-02-07T12:00:00"))).toBe("2027-02-07");
  });

  it("gebruikt de plaatselijke dag, niet de UTC-dag", () => {
    // Om 23:30 lokale tijd is het in UTC al de volgende dag; de app rekent in
    // plaatselijke datums, dus dit moet 7 februari blijven.
    expect(todayIso(new Date("2027-02-07T23:30:00"))).toBe("2027-02-07");
  });
});

describe("isCurrentStop", () => {
  it("is waar op de check-indag", () => {
    expect(isCurrentStop(route[1], "2027-01-27", false)).toBe(true);
  });

  it("is waar op een dag middenin het verblijf", () => {
    expect(isCurrentStop(route[1], "2027-01-28", false)).toBe(true);
  });

  it("is onwaar op de check-outdag, want dan slaap je elders", () => {
    expect(isCurrentStop(route[1], "2027-01-30", false)).toBe(false);
  });

  it("is onwaar vóór de check-in", () => {
    expect(isCurrentStop(route[1], "2027-01-26", false)).toBe(false);
  });

  it("pakt bij de laatste stop de einddatum er wel bij", () => {
    expect(isCurrentStop(route[3], "2027-02-02", true)).toBe(true);
  });

  it("is bij de laatste stop onwaar na de einddatum", () => {
    expect(isCurrentStop(route[3], "2027-02-03", true)).toBe(false);
  });

  it("geldt bij een doortocht voor precies één dag", () => {
    expect(isCurrentStop(route[2], "2027-01-30", false)).toBe(true);
    expect(isCurrentStop(route[2], "2027-01-29", false)).toBe(false);
    expect(isCurrentStop(route[2], "2027-01-31", false)).toBe(false);
  });
});

describe("currentStopIds", () => {
  it("wijst één stop aan op een gewone dag", () => {
    expect(currentStopIds(route, "2027-01-28")).toEqual(["kandy"]);
  });

  it("wijst op een doortocht-dag zowel de doortocht als de aankomst aan", () => {
    expect(currentStopIds(route, "2027-01-30")).toEqual(["yala", "ella"]);
  });

  it("wijst niets aan vóór de reis", () => {
    expect(currentStopIds(route, "2027-01-01")).toEqual([]);
  });

  it("wijst niets aan na de reis", () => {
    expect(currentStopIds(route, "2027-03-01")).toEqual([]);
  });

  it("laat geen enkele dag van de reis onbenoemd", () => {
    const dagen = ["2027-01-26", "2027-01-27", "2027-01-28", "2027-01-29", "2027-01-30", "2027-01-31", "2027-02-01", "2027-02-02"];
    for (const dag of dagen) {
      expect(currentStopIds(route, dag), dag).not.toEqual([]);
    }
  });
});

describe("currentStopId", () => {
  it("kiest op een doortocht-dag de doortocht, want dat is wat je die dag doet", () => {
    expect(currentStopId(route, "2027-01-30")).toBe("yala");
  });

  it("is null buiten de reis", () => {
    expect(currentStopId(route, "2027-01-01")).toBeNull();
  });
});
