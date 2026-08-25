import { describe, expect, it } from "vitest";
import { getTripStatus } from "./countdown";

const START = "2027-01-25";
const END = "2027-02-18";

/** Lokale middag, zodat een test niet per tijdzone op een andere kalenderdag valt. */
function at(dateOnly: string, time = "12:00"): Date {
  return new Date(`${dateOnly}T${time}:00`);
}

describe("getTripStatus", () => {
  it("telt af vóór vertrek", () => {
    const status = getTripStatus(START, END, at("2027-01-20"));
    expect(status.phase).toBe("upcoming");
    expect(status.daysUntilStart).toBe(5);
  });

  it("telt de hele reis inclusief begin- en einddag", () => {
    // 25 januari tot en met 18 februari is 25 dagen.
    expect(getTripStatus(START, END, at("2027-01-20")).totalDays).toBe(25);
  });

  it("staat op dag 1 op de vertrekdag zelf", () => {
    const status = getTripStatus(START, END, at(START));
    expect(status.phase).toBe("ongoing");
    expect(status.currentDay).toBe(1);
  });

  it("staat op de laatste dag op de einddag zelf", () => {
    const status = getTripStatus(START, END, at(END));
    expect(status.phase).toBe("ongoing");
    expect(status.currentDay).toBe(25);
  });

  it("is afgerond de dag na de einddag", () => {
    const status = getTripStatus(START, END, at("2027-02-19"));
    expect(status.phase).toBe("completed");
    expect(status.currentDay).toBe(status.totalDays);
  });

  it("houdt geen negatieve aftelling over als de reis loopt", () => {
    expect(getTripStatus(START, END, at("2027-02-01")).daysUntilStart).toBe(0);
  });

  it("negeert het tijdstip binnen de dag", () => {
    const ochtend = getTripStatus(START, END, at("2027-01-20", "00:01"));
    const avond = getTripStatus(START, END, at("2027-01-20", "23:59"));
    expect(ochtend).toEqual(avond);
  });

  it("telt de laatste nacht vóór vertrek als één dag", () => {
    expect(getTripStatus(START, END, at("2027-01-24", "23:30")).daysUntilStart).toBe(1);
  });

  it("rekent over de zomertijdgrens in hele dagen", () => {
    // De klok gaat op 28 maart 2027 een uur vooruit; zonder afronding zou dit
    // 30 dagen worden in plaats van 31.
    expect(getTripStatus("2027-04-01", "2027-04-10", at("2027-03-01")).daysUntilStart).toBe(31);
  });

  it("werkt voor een reis van één dag", () => {
    const status = getTripStatus("2027-01-25", "2027-01-25", at("2027-01-25"));
    expect(status.totalDays).toBe(1);
    expect(status.currentDay).toBe(1);
    expect(status.phase).toBe("ongoing");
  });
});
