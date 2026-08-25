import { describe, expect, it } from "vitest";
import { computeNightsCheck, isBookingSettled, isStopover, nightsLabel } from "./nights";
import type { Stop } from "../types/trip";

/** Alleen de velden die deze functies lezen; de rest van Stop doet hier niet mee. */
function stop(nights: number, booked = false): Stop {
  return { nights, booked } as Stop;
}

describe("isStopover", () => {
  it("noemt 0 nachten een doortocht", () => {
    expect(isStopover(stop(0))).toBe(true);
  });

  it("noemt 1 nacht een verblijf", () => {
    expect(isStopover(stop(1))).toBe(false);
  });
});

describe("nightsLabel", () => {
  it("gebruikt enkelvoud bij één nacht", () => {
    expect(nightsLabel(stop(1))).toBe("1 nacht");
  });

  it("gebruikt meervoud bij meer nachten", () => {
    expect(nightsLabel(stop(3))).toBe("3 nachten");
  });

  it("zegt bij een doortocht dat er niet overnacht wordt", () => {
    expect(nightsLabel(stop(0))).toBe("geen overnachting");
  });
});

describe("isBookingSettled", () => {
  it("beschouwt een geboekt verblijf als afgerond", () => {
    expect(isBookingSettled(stop(2, true))).toBe(true);
  });

  it("beschouwt een ongeboekt verblijf als open", () => {
    expect(isBookingSettled(stop(2, false))).toBe(false);
  });

  it("beschouwt een doortocht als afgerond, want die vraagt geen kamer", () => {
    expect(isBookingSettled(stop(0, false))).toBe(true);
  });
});

describe("computeNightsCheck", () => {
  it("keurt een kloppende planning goed", () => {
    const result = computeNightsCheck([stop(3), stop(2), stop(0)], 5);
    expect(result).toEqual({ total: 5, expected: 5, diff: 0, ok: true });
  });

  it("meldt een tekort met een negatief verschil", () => {
    expect(computeNightsCheck([stop(3)], 5)).toMatchObject({ total: 3, diff: -2, ok: false });
  });

  it("meldt een overschot met een positief verschil", () => {
    expect(computeNightsCheck([stop(7)], 5)).toMatchObject({ total: 7, diff: 2, ok: false });
  });

  it("laat doortochten buiten het nachtentotaal", () => {
    expect(computeNightsCheck([stop(0), stop(0)], 0).total).toBe(0);
  });

  it("gaat om met een lege route", () => {
    expect(computeNightsCheck([], 0)).toEqual({ total: 0, expected: 0, diff: 0, ok: true });
  });
});
