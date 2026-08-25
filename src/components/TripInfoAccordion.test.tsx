import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TripInfoAccordion } from "./TripInfoAccordion";
import type { Stop, Trip } from "../types/trip";

const trip = {
  flights: {
    outbound: { booked: true, date: "ma 25 jan" },
    return: { booked: true, date: "do 18 feb" },
  },
} as Trip;

const stops = [
  { id: "kandy", name: "Kandy", nights: 2, booked: false, dates: "ma 1 tot wo 3 feb", transportTo: { mode: "car", label: "", duration: "" }, activities: [] },
  { id: "ella", name: "Ella", nights: 3, booked: true, warn: "reserveer de trein", dates: "wo 3 tot zo 7 feb", transportTo: { mode: "train", label: "", duration: "" }, activities: [] },
] as unknown as Stop[];

const STORAGE_KEY = "srilanka-trip:checklist-done";

function setup() {
  const onJumpToStop = vi.fn();
  render(
    <TripInfoAccordion
      trip={trip}
      stops={stops}
      openQuestions={["Welke SIM?"]}
      todos={["Visum regelen"]}
      notes={[]}
      onJumpToStop={onJumpToStop}
    />,
  );
  // De sectie staat ingeklapt; alles hieronder gaat over de inhoud.
  fireEvent.click(screen.getByRole("button", { name: /Reisinfo/ }));
  return { onJumpToStop };
}

function badge(): string {
  // De teller naast de kop: "nog te doen", of "Klaar" als alles af is.
  const nogTeDoen = screen.queryByLabelText(/nog te doen/);
  return nogTeDoen ? (nogTeDoen.textContent ?? "") : (screen.getByLabelText("Alles afgevinkt").textContent ?? "");
}

function checkbox(label: string) {
  return screen.getByRole("checkbox", { name: new RegExp(label) });
}

describe("TripInfoAccordion, checklist", () => {
  it("toont de openstaande punten uit alle groepen", () => {
    setup();
    // 1 ongeboekt verblijf + 1 waarschuwing + 1 todo + 1 open vraag
    expect(badge()).toBe("4");
  });

  it("laat een geboekt verblijf en een doortocht buiten de boekingslijst", () => {
    setup();
    expect(screen.getByRole("checkbox", { name: /"Kandy"/ })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /"Ella" afvinken/ })).toBeNull();
  });

  it("telt de badge af bij het afvinken", () => {
    setup();
    fireEvent.click(checkbox('"Kandy" afvinken'));
    expect(badge()).toBe("3");
    fireEvent.click(checkbox('"Visum regelen" afvinken'));
    expect(badge()).toBe("2");
  });

  it("telt weer op bij het openzetten", () => {
    setup();
    fireEvent.click(checkbox('"Kandy" afvinken'));
    expect(badge()).toBe("3");
    fireEvent.click(checkbox('"Kandy" weer openzetten'));
    expect(badge()).toBe("4");
  });

  it("zegt Klaar als er niets meer openstaat", () => {
    setup();
    for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
    expect(badge()).toBe("Klaar");
  });

  it("houdt de teller per groep bij", () => {
    setup();
    // Alle vier de groepen hebben hier precies één item.
    expect(screen.getAllByText("0/1")).toHaveLength(4);
    fireEvent.click(checkbox('"Visum regelen" afvinken'));
    expect(screen.getAllByText("0/1")).toHaveLength(3);
    expect(screen.getAllByText("1/1")).toHaveLength(1);
  });

  it("bewaart het afvinken in localStorage", () => {
    setup();
    fireEvent.click(checkbox('"Visum regelen" afvinken'));
    const opgeslagen = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(opgeslagen).toEqual(["todo-visum-regelen"]);
  });

  it("gebruikt een sleutel uit de tekst, niet uit de positie in de lijst", () => {
    // Een op de index gebaseerde sleutel zou bij het herordenen van
    // content/trip.json het vinkje naar een ander item verhuizen.
    setup();
    fireEvent.click(checkbox('"Welke SIM\\?" afvinken'));
    const opgeslagen = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(opgeslagen).toEqual(["question-welke-sim"]);
  });

  it("leest een eerder afgevinkt item weer terug", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["todo-visum-regelen"]));
    setup();
    expect(badge()).toBe("3");
    expect(checkbox('"Visum regelen" weer openzetten').getAttribute("aria-checked")).toBe("true");
  });

  it("negeert onleesbare opslag in plaats van om te vallen", () => {
    window.localStorage.setItem(STORAGE_KEY, "{dit is geen json");
    setup();
    expect(badge()).toBe("4");
  });

  it("springt naar de stop bij een klik op de tekst, niet op het vinkje", () => {
    const { onJumpToStop } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Naar Kandy, ma 1 tot wo 3 feb" }));
    expect(onJumpToStop).toHaveBeenCalledWith("kandy");
  });

  it("springt niet bij het afvinken", () => {
    const { onJumpToStop } = setup();
    fireEvent.click(checkbox('"Kandy" afvinken'));
    expect(onJumpToStop).not.toHaveBeenCalled();
  });
});
