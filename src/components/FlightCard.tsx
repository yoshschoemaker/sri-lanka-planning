import type { Flight } from "../types/trip";

export function FlightCard({ flight, direction }: { flight: Flight; direction: "heen" | "terug" }) {
  return (
    <div className="flex-1 rounded-2xl border border-ink/10 bg-white/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          {direction === "heen" ? "Vlucht heen" : "Vlucht terug"} · {flight.date}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            flight.booked ? "bg-forest/10 text-forest-dark" : "bg-terracotta/10 text-terracotta-dark"
          }`}
        >
          {flight.booked ? "✓ Geboekt" : "○ Nog te boeken"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="text-center">
          <p className="font-serif text-2xl font-semibold text-ink">{flight.from}</p>
          <p className="text-xs text-ink-soft">{flight.depart}</p>
        </div>
        <div className="flex flex-1 flex-col items-center px-1">
          <span className="text-xs text-ink-soft">{flight.duration}</span>
          <span aria-hidden className="my-1 h-px w-full bg-ink/15" />
          <span className="text-xs text-ink-soft">{flight.airline}</span>
        </div>
        <div className="text-center">
          <p className="font-serif text-2xl font-semibold text-ink">{flight.to}</p>
          <p className="text-xs text-ink-soft">{flight.arrive}</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-ink-soft">via {flight.via}</p>
    </div>
  );
}
