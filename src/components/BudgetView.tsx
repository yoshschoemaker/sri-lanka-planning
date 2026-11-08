import { useState } from "react";
import type { Budget, Stop, Trip } from "../types/trip";
import { buildBudgetOverview, formatEuro, splitDivisor, type BudgetSplit } from "../utils/budget";
import { BedIcon, PlaneIcon } from "./icons";

interface BudgetViewProps {
  trip: Trip;
  stops: Stop[];
  budget: Budget;
}

const SPLITS: { id: BudgetSplit; label: string }[] = [
  { id: "total", label: "Totaal" },
  { id: "couple", label: "Per stel" },
  { id: "person", label: "Per persoon" },
];

const STORAGE_KEY = "srilanka-trip:budget-split";

/** Onthoudt per toestel welke weergave je het laatst koos. Lukt opslaan niet, dan begint het gewoon bij Totaal. */
function readSplit(): BudgetSplit {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "couple" || raw === "person" ? raw : "total";
  } catch {
    return "total";
  }
}

function writeSplit(split: BudgetSplit): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, split);
  } catch {
    // Alleen een gemak; zonder opslag geldt de keuze voor deze sessie.
  }
}

/**
 * Wat de reis kost: de verblijven, de vliegtickets en het totaal. Alle bedragen
 * staan als groepstotaal in content/trip.json; de knoppen bovenaan delen ze
 * alleen bij het tonen door per stel of per persoon.
 */
export function BudgetView({ trip, stops, budget }: BudgetViewProps) {
  const [split, setSplit] = useState<BudgetSplit>(readSplit);
  const overview = buildBudgetOverview(stops, budget);
  const divisor = splitDivisor(split, budget.people);
  const show = (amount: number) => formatEuro(amount / divisor);
  const suffix = split === "couple" ? " per stel" : split === "person" ? " per persoon" : "";

  const chooseSplit = (next: BudgetSplit) => {
    setSplit(next);
    writeSplit(next);
  };

  const { outbound } = trip.flights;

  return (
    <div className="pt-safe">
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="font-serif text-sm font-semibold uppercase tracking-[0.35em] text-terracotta-dark">Kosten</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">Budget</h1>
        <p className="mt-2 text-base text-ink-soft">
          Wat de reis kost voor {budget.people} personen, oftewel {budget.people / 2}{" "}
          {budget.people / 2 === 1 ? "stel" : "stellen"}.
        </p>

        <div role="group" aria-label="Bedragen tonen als" className="mt-6 inline-flex gap-1 rounded-full border border-ink/15 bg-white/60 p-1">
          {SPLITS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={split === option.id}
              onClick={() => chooseSplit(option.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                split === option.id ? "bg-ink text-cream" : "text-ink-soft hover:bg-ink/5"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <section aria-labelledby="budget-stays" className="mt-8">
          <h2 id="budget-stays" className="mb-3 flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
            <BedIcon className="h-5 w-5 text-ink-soft" />
            Verblijven
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-card">
            {overview.stays.map((line) => (
              <li key={line.stopId} className="flex items-start gap-3 border-b border-ink/5 px-4 py-3 last:border-b-0 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{line.stopName}</p>
                  <p className="truncate text-sm text-ink-soft">{line.accommodation ?? "Nog niet geboekt"}</p>
                  <p className="text-xs text-ink-soft">
                    {line.dates} · {line.nights} {line.nights === 1 ? "nacht" : "nachten"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {line.price === null ? (
                    <p className="text-sm italic text-ink-soft">prijs volgt</p>
                  ) : (
                    <>
                      <p className="font-serif text-lg font-semibold tabular-nums text-ink">{show(line.price)}</p>
                      <p className="text-xs tabular-nums text-ink-soft">{show(line.price / line.nights)} p/n</p>
                    </>
                  )}
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3 bg-sand/40 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">Totaal verblijven</p>
                {overview.staysMissing > 0 && (
                  <p className="text-xs text-ink-soft">
                    {overview.staysMissing} {overview.staysMissing === 1 ? "verblijf" : "verblijven"} nog zonder prijs
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-serif text-lg font-semibold tabular-nums text-ink">{show(overview.staysTotal)}</p>
                {overview.pricedNights > 0 && (
                  <p className="text-xs tabular-nums text-ink-soft">
                    gem. {show(overview.staysTotal / overview.pricedNights)} per nacht
                  </p>
                )}
              </div>
            </li>
          </ul>
        </section>

        <section aria-labelledby="budget-flights" className="mt-8">
          <h2 id="budget-flights" className="mb-3 flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
            <PlaneIcon className="h-5 w-5 text-ink-soft" />
            Vliegtickets
          </h2>
          <div className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 shadow-card sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">
                {outbound.from} ⇄ {outbound.to}
              </p>
              <p className="text-sm text-ink-soft">
                {outbound.airline} · via {outbound.via}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {overview.flights === null ? (
                <p className="text-sm italic text-ink-soft">prijs volgt</p>
              ) : (
                <p className="font-serif text-lg font-semibold tabular-nums text-ink">{show(overview.flights)}</p>
              )}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="budget-total"
          className="mt-10 rounded-3xl bg-forest p-6 text-cream shadow-card sm:p-8"
        >
          <p id="budget-total" className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">
            Totaal{suffix}
          </p>
          <p className="mt-1 font-serif text-5xl font-bold tabular-nums" aria-live="polite">
            {show(overview.total)}
          </p>
          <p className="mt-2 text-sm text-cream/80">
            Verblijven {show(overview.staysTotal)}
            {overview.flights !== null && <> + vliegtickets {show(overview.flights)}</>}
          </p>
          {overview.missingCount > 0 && (
            <p className="mt-3 text-sm text-cream/80">
              Nog niet compleet: {overview.missingCount} {overview.missingCount === 1 ? "post heeft" : "posten hebben"} nog
              geen prijs.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
