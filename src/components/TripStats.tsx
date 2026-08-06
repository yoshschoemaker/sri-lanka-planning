import type { Stop, Trip, TransportMode, TransportModeKey } from "../types/trip";
import { StatTile, type StatTileTone } from "./StatTile";
import { getTripStatus } from "../utils/countdown";
import { computeNightsCheck } from "../utils/nights";
import { regions } from "../data/regions";

interface TripStatsProps {
  trip: Trip;
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  onJumpToStop: (id: string) => void;
}

export function TripStats({ trip, stops, transportModes, onJumpToStop }: TripStatsProps) {
  const status = getTripStatus(trip.start, trip.end);
  const nights = computeNightsCheck(stops, trip.totalNights);
  const bookedCount = stops.filter((stop) => stop.booked).length;
  const bookingRatio = stops.length === 0 ? 0 : bookedCount / stops.length;

  const modeEntries = Object.entries(transportModes) as [TransportModeKey, TransportMode][];
  const modeCounts = modeEntries.map(([key, mode]) => ({
    key,
    mode,
    count: stops.filter((stop) => stop.transportTo.mode === key).length,
  }));

  let countdownValue: string | number;
  let countdownDetail: string;
  let countdownTone: StatTileTone = "neutral";

  if (status.phase === "upcoming") {
    countdownValue = status.daysUntilStart;
    countdownDetail = status.daysUntilStart === 1 ? "dag tot vertrek" : "dagen tot vertrek";
  } else if (status.phase === "ongoing") {
    countdownValue = status.currentDay;
    countdownDetail = `van ${status.totalDays} dagen · onderweg`;
    countdownTone = "positive";
  } else {
    countdownValue = "✓";
    countdownDetail = "reis afgerond";
    countdownTone = "positive";
  }

  return (
    <section className="relative z-10 -mt-14 sm:-mt-20">
      <div className="rounded-3xl border border-ink/10 bg-cream/95 p-5 shadow-float backdrop-blur sm:p-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
          <StatTile
            icon="🗓"
            label="Countdown"
            value={countdownValue}
            detail={countdownDetail}
            tone={countdownTone}
          />

          <StatTile
            icon="🌙"
            label="Nachten"
            value={nights.total}
            detail={
              nights.ok ? "klopt met planning" : `${nights.diff > 0 ? "+" : ""}${nights.diff} t.o.v. ${nights.expected}`
            }
            tone={nights.ok ? "positive" : "warning"}
          />

          <StatTile
            icon="🧳"
            label="Boekingen"
            value={`${bookedCount}/${stops.length}`}
            detail="verblijven geboekt"
            tone={bookedCount === stops.length ? "positive" : "neutral"}
          >
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sand" aria-hidden>
              <div className="h-full rounded-full bg-forest" style={{ width: `${bookingRatio * 100}%` }} />
            </div>
          </StatTile>

          <StatTile icon="🧭" label="Vervoer">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-sand" aria-hidden>
              {modeCounts
                .filter((entry) => entry.count > 0)
                .map((entry, i, arr) => (
                  <span
                    key={entry.key}
                    style={{
                      width: `${(entry.count / stops.length) * 100}%`,
                      backgroundColor: entry.mode.color,
                      marginRight: i < arr.length - 1 ? 2 : 0,
                    }}
                  />
                ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
              {modeCounts.map((entry) => (
                <li key={entry.key} className="inline-flex items-center gap-1">
                  <span aria-hidden>{entry.mode.icon}</span>
                  <span className="sr-only">{entry.mode.label}:</span>
                  {entry.count}
                </li>
              ))}
            </ul>
          </StatTile>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-5">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">Spring naar</span>
          {regions.map((region) => {
            const anchorStop = stops[region.orderStart - 1];
            if (!anchorStop) return null;
            return (
              <button
                key={region.id}
                type="button"
                onClick={() => onJumpToStop(anchorStop.id)}
                className="rounded-full border border-ink/15 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-terracotta-light hover:text-ink"
              >
                {region.name}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
