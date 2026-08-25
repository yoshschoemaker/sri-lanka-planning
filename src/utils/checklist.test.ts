import { describe, expect, it } from "vitest";
import { buildTripChecklist } from "./checklist";
import type { Stop, Trip } from "../types/trip";

function trip(outboundBooked = false, returnBooked = false): Trip {
  return {
    flights: {
      outbound: { booked: outboundBooked, date: "ma 25 jan" },
      return: { booked: returnBooked, date: "do 18 feb" },
    },
  } as Trip;
}

function stop(id: string, overrides: Partial<Stop> = {}): Stop {
  return { id, name: id, nights: 2, booked: false, dates: "wo 27 tot vr 29 jan", transportTo: { mode: "car", label: "", duration: "" }, ...overrides } as Stop;
}

describe("buildTripChecklist", () => {
  it("zet een ongeboekte vlucht op de boekingslijst", () => {
    const list = buildTripChecklist(trip(), [], [], []);
    expect(list.toBook.map((item) => item.label)).toEqual(["Vlucht heen", "Vlucht terug"]);
  });

  it("laat geboekte vluchten weg", () => {
    const list = buildTripChecklist(trip(true, true), [], [], []);
    expect(list.toBook).toEqual([]);
  });

  it("zet een ongeboekt verblijf op de boekingslijst met een link naar de stop", () => {
    const list = buildTripChecklist(trip(true, true), [stop("kandy")], [], []);
    expect(list.toBook).toHaveLength(1);
    expect(list.toBook[0]).toMatchObject({ label: "kandy", stopId: "kandy" });
  });

  it("laat een doortocht buiten de boekingslijst, want die heeft geen verblijf", () => {
    const list = buildTripChecklist(trip(true, true), [stop("yala", { nights: 0 })], [], []);
    expect(list.toBook).toEqual([]);
  });

  it("laat een geboekt verblijf buiten de boekingslijst", () => {
    const list = buildTripChecklist(trip(true, true), [stop("kandy", { booked: true })], [], []);
    expect(list.toBook).toEqual([]);
  });

  it("neemt de waarschuwing van een stop over met een link naar die stop", () => {
    const list = buildTripChecklist(trip(true, true), [stop("ella", { booked: true, warn: "druk in februari" })], [], []);
    expect(list.warnings).toHaveLength(1);
    expect(list.warnings[0]).toMatchObject({ label: "druk in februari", detail: "ella", stopId: "ella" });
  });

  it("neemt ook de waarschuwing van een reisetappe over", () => {
    const stopWithLegWarning = stop("ella", {
      booked: true,
      transportTo: { mode: "train", label: "", duration: "", warn: "reserveer op tijd" },
    });
    const list = buildTripChecklist(trip(true, true), [stopWithLegWarning], [], []);
    expect(list.warnings[0]).toMatchObject({ label: "reserveer op tijd", detail: "onderweg naar ella" });
  });

  it("houdt beide waarschuwingen van één stop apart", () => {
    const both = stop("ella", {
      booked: true,
      warn: "druk",
      transportTo: { mode: "train", label: "", duration: "", warn: "reserveren" },
    });
    const list = buildTripChecklist(trip(true, true), [both], [], []);
    expect(list.warnings).toHaveLength(2);
    // Unieke keys, anders klapt de React-lijst om op dubbele sleutels.
    expect(new Set(list.warnings.map((w) => w.key)).size).toBe(2);
  });

  it("neemt losse todo's en open vragen over", () => {
    const list = buildTripChecklist(trip(true, true), [], ["Welke SIM?"], ["Visum aanvragen"]);
    expect(list.toArrange.map((i) => i.label)).toEqual(["Visum aanvragen"]);
    expect(list.questions.map((i) => i.label)).toEqual(["Welke SIM?"]);
  });

  it("telt alle groepen samen in totalCount", () => {
    const list = buildTripChecklist(
      trip(),
      [stop("kandy"), stop("ella", { booked: true, warn: "druk" })],
      ["Welke SIM?"],
      ["Visum"],
    );
    // 2 vluchten + 1 verblijf + 1 todo + 1 waarschuwing + 1 vraag
    expect(list.totalCount).toBe(6);
    expect(list.totalCount).toBe(
      list.toBook.length + list.toArrange.length + list.warnings.length + list.questions.length,
    );
  });

  it("is helemaal leeg als er niets te doen is", () => {
    const list = buildTripChecklist(trip(true, true), [stop("kandy", { booked: true })], [], []);
    expect(list.totalCount).toBe(0);
  });

  it("geeft elk item een unieke key over alle groepen heen", () => {
    const list = buildTripChecklist(
      trip(),
      [stop("kandy"), stop("ella", { warn: "druk" })],
      ["vraag a", "vraag b"],
      ["todo a", "todo b"],
    );
    const keys = [...list.toBook, ...list.toArrange, ...list.warnings, ...list.questions].map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
