import type { Stop, Trip, TransportMode, TransportModeKey } from "../types/trip";
import { StatTile, type StatTileTone } from "./StatTile";
import { CalendarIcon, CompassIcon, MoonIcon, SuitcaseIcon } from "./icons";
import { useTripStatus } from "../utils/useTripStatus";
import { computeNightsCheck, isStopover } from "../utils/nights";
import { getRegionAnchorStop, regions } from "../data/tripContent";

interface TripStatsProps {
  trip: Trip;
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  /** De stop van vandaag, of null zolang de reis niet loopt. */
  todayStopId: string | null;
  onJumpToStop: (id: string) => void;
}

export function TripStats({ trip, stops, transportModes, todayStopId, onJumpToStop }: TripStatsProps) {
  const status = useTripStatus(trip.start, trip.end);
  const nights = computeNightsCheck(stops, trip.totalNights);
  // Alleen stops met nachten hebben een verblijf; een doortocht telt niet mee in de boekingsteller.
  const stays = stops.filter((stop) => !isStopover(stop));
  const bookedCount = stays.filter((stop) => stop.booked).length;
  const bookingRatio = stays.length === 0 ? 0 : bookedCount / stays.length;

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
            icon={<CalendarIcon className="h-3.5 w-3.5" />}
            label="Countdown"
            value={countdownValue}
            detail={countdownDetail}
            tone={countdownTone}
          />

          <StatTile
            icon={<MoonIcon className="h-3.5 w-3.5" />}
            label="Nachten"
            value={nights.total}
            detail={
              nights.ok ? "klopt met planning" : `${nights.diff > 0 ? "+" : ""}${nights.diff} t.o.v. ${nights.expected}`
            }
            tone={nights.ok ? "positive" : "warning"}
          />

          <StatTile
            icon={<SuitcaseIcon className="h-3.5 w-3.5" />}
            label="Boekingen"
            value={`${bookedCount}/${stays.length}`}
            detail="verblijven geboekt"
            tone={bookedCount === stays.length ? "positive" : "neutral"}
          >
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sand" aria-hidden>
              <div className="h-full rounded-full bg-forest" style={{ width: `${bookingRatio * 100}%` }} />
            </div>
          </StatTile>

          <StatTile icon={<CompassIcon className="h-3.5 w-3.5" />} label="Vervoer">
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
          {/* Voorop en in forest, want onderweg is dit de enige knop die je wil. */}
          {todayStopId && (
            <button
              type="button"
              onClick={() => onJumpToStop(todayStopId)}
              className="rounded-full bg-forest px-3.5 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-forest-dark active:scale-95"
            >
              Vandaag
            </button>
          )}
          {regions.map((region) => {
            const anchorStop = getRegionAnchorStop(region.id);
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
