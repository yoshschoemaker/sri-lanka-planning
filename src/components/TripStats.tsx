import type { Stop, Trip } from "../types/trip";
import { StatTile, type StatTileTone } from "./StatTile";
import { CalendarIcon, ClipboardIcon, MoonIcon, SuitcaseIcon } from "./icons";
import { ChecklistRow } from "./TripChecklist";
import { buildTodoItems } from "../utils/checklist";
import type { ChecklistProgress } from "../utils/checklistProgress";
import { useTripStatus } from "../utils/useTripStatus";
import { computeNightsCheck, isStopover } from "../utils/nights";
import { getRegionAnchorStop, regions } from "../data/tripContent";

interface TripStatsProps {
  trip: Trip;
  stops: Stop[];
  /** De stop van vandaag, of null zolang de reis niet loopt. */
  todayStopId: string | null;
  onJumpToStop: (id: string) => void;
  /** Losse regeldingen uit content/trip.json (visum, vervoer, vaccinaties). */
  todos: string[];
  checklistProgress: ChecklistProgress;
}

export function TripStats({ trip, stops, todayStopId, onJumpToStop, todos, checklistProgress }: TripStatsProps) {
  const status = useTripStatus(trip.start, trip.end);
  const nights = computeNightsCheck(stops, trip.totalNights);
  // Alleen stops met nachten hebben een verblijf; een doortocht telt niet mee in de boekingsteller.
  const stays = stops.filter((stop) => !isStopover(stop));
  const bookedCount = stays.filter((stop) => stop.booked).length;
  const bookingRatio = stays.length === 0 ? 0 : bookedCount / stays.length;

  const todoItems = buildTodoItems(todos);
  const todoDone = checklistProgress.doneCount(todoItems.map((item) => item.key));
  const todoRatio = todoItems.length === 0 ? 0 : todoDone / todoItems.length;

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
        {/*
          Vier tegels: op sm en breder één rij. Op mobiel staan Countdown en
          Nachten naast elkaar en krijgen Boekingen en de takenlijst elk de
          volle breedte, zodat de lengte van de lijst geen tegel ernaast oprekt.
        */}
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
            className="col-span-2 sm:col-span-1"
          >
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sand" aria-hidden>
              <div className="h-full rounded-full bg-forest" style={{ width: `${bookingRatio * 100}%` }} />
            </div>
          </StatTile>

          {todoItems.length > 0 && (
            <StatTile
              icon={<ClipboardIcon className="h-3.5 w-3.5" />}
              label="Te regelen"
              value={`${todoDone}/${todoItems.length}`}
              detail="taken afgerond"
              tone={todoDone === todoItems.length ? "positive" : "neutral"}
              className="col-span-2 sm:col-span-1"
            >
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sand" aria-hidden>
                <div className="h-full rounded-full bg-forest" style={{ width: `${todoRatio * 100}%` }} />
              </div>
              <ul className="mt-2 flex flex-col gap-1.5" aria-label="Te regelen">
                {todoItems.map((item) => (
                  <ChecklistRow key={item.key} item={item} progress={checklistProgress} onJumpToStop={onJumpToStop} />
                ))}
              </ul>
            </StatTile>
          )}

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
