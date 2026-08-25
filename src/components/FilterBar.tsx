import type { ActivityPriority, Stop, TransportModeKey, TransportMode } from "../types/trip";
import { isBookingSettled } from "../utils/nights";
import { CloseIcon } from "./icons";

export type StatusFilter = "all" | "toBook";
/**
 * TransportModeKey is met opzet `string` (een nieuwe vervoerssoort is een
 * JSON-wijziging, zie types/trip.ts), dus `| "all"` voegt voor de compiler niets
 * toe. Het blijft staan omdat het benoemt dat "all" hier een geldige waarde met
 * eigen betekenis is, en niet zomaar een van de sleutels.
 */
// oxlint-disable-next-line typescript/no-redundant-type-constituents
export type ModeFilter = TransportModeKey | "all";
export type PriorityFilter = ActivityPriority | "all";

const PRIORITY_OPTIONS: { key: PriorityFilter; label: string }[] = [
  { key: "must", label: "Must see/do" },
  { key: "nice", label: "Leuk idee" },
  { key: "maybe", label: "Misschien" },
];

interface FilterBarProps {
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  modeFilter: ModeFilter;
  onModeFilterChange: (value: ModeFilter) => void;
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (value: PriorityFilter) => void;
  onReset: () => void;
}

export function FilterBar({
  stops,
  transportModes,
  statusFilter,
  onStatusFilterChange,
  modeFilter,
  onModeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  onReset,
}: FilterBarProps) {
  const modeEntries = Object.entries(transportModes) as [TransportModeKey, TransportMode][];

  const stopFilterActive = statusFilter !== "all" || modeFilter !== "all";
  const anyFilterActive = stopFilterActive || priorityFilter !== "all";

  const highlightedStops = stops.filter((stop) => {
    const statusDimmed = statusFilter === "toBook" && isBookingSettled(stop);
    const modeDimmed = modeFilter !== "all" && modeFilter !== stop.transportTo.mode;
    return !statusDimmed && !modeDimmed;
  }).length;

  const activities = stops.flatMap((stop) => stop.activities);
  const highlightedActivities = activities.filter((activity) => activity.priority === priorityFilter).length;

  /**
   * De filters dimmen wat niet past in plaats van het te verbergen, zodat de
   * route zijn vorm en volgorde houdt. De teller zei daardoor "komen overeen"
   * over een lijst waarin niets verdween, en liet de prioriteitsfilter (die
   * activiteiten dimt, geen stops) volledig buiten beschouwing. Nu benoemt hij
   * per soort filter wat er daadwerkelijk uitgelicht is.
   */
  const summary = [
    stopFilterActive ? `${highlightedStops} van ${stops.length} stops` : null,
    priorityFilter !== "all" ? `${highlightedActivities} van ${activities.length} activiteiten` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <button
          type="button"
          role="switch"
          aria-checked={statusFilter === "toBook"}
          onClick={() => onStatusFilterChange(statusFilter === "toBook" ? "all" : "toBook")}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            statusFilter === "toBook"
              ? "border-terracotta-dark bg-terracotta text-white"
              : "border-ink/15 bg-white/60 text-ink-soft hover:border-terracotta-light"
          }`}
        >
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${statusFilter === "toBook" ? "bg-white" : "bg-terracotta"}`}
          />
          Alleen nog te boeken
        </button>

        <div className="flex min-w-0 gap-1 overflow-x-auto rounded-full border border-ink/15 bg-white/60 p-1">
          <button
            type="button"
            aria-pressed={modeFilter === "all"}
            onClick={() => onModeFilterChange("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              modeFilter === "all" ? "bg-ink text-cream" : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            Alle vervoer
          </button>
          {modeEntries.map(([key, mode]) => (
            <button
              key={key}
              type="button"
              aria-pressed={modeFilter === key}
              onClick={() => onModeFilterChange(modeFilter === key ? "all" : key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                modeFilter === key ? "text-white" : "text-ink-soft hover:bg-ink/5"
              }`}
              style={modeFilter === key ? { backgroundColor: mode.color } : undefined}
            >
              <span aria-hidden>{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 gap-1 overflow-x-auto rounded-full border border-ink/15 bg-white/60 p-1">
          <button
            type="button"
            aria-pressed={priorityFilter === "all"}
            onClick={() => onPriorityFilterChange("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              priorityFilter === "all" ? "bg-ink text-cream" : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            Alle activiteiten
          </button>
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={priorityFilter === option.key}
              onClick={() => onPriorityFilterChange(priorityFilter === option.key ? "all" : option.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                priorityFilter === option.key ? "bg-terracotta-dark text-white" : "text-ink-soft hover:bg-ink/5"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          {/* aria-live: met alleen zichtbare tekst hoort iemand met een
              schermlezer niet wat een filterklik heeft opgeleverd. */}
          <p className="text-xs font-medium text-ink-soft" aria-live="polite">
            {summary.length > 0 ? `${summary.join(" · ")} uitgelicht` : "Geen filter actief"}
          </p>
          {anyFilterActive && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white/60 px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-terracotta-light hover:text-terracotta-dark active:scale-95"
            >
              <CloseIcon className="h-3 w-3" />
              Wis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
