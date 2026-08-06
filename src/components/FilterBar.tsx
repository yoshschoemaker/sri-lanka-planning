import type { ActivityPriority, TransportModeKey, TransportMode } from "../types/trip";
import { stops } from "../data/data";

export type StatusFilter = "all" | "toBook";
export type ModeFilter = TransportModeKey | "all";
export type PriorityFilter = ActivityPriority | "all";

const PRIORITY_OPTIONS: { key: PriorityFilter; label: string }[] = [
  { key: "must", label: "Must see/do" },
  { key: "nice", label: "Leuk idee" },
  { key: "maybe", label: "Misschien" },
];

interface FilterBarProps {
  transportModes: Record<TransportModeKey, TransportMode>;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  modeFilter: ModeFilter;
  onModeFilterChange: (value: ModeFilter) => void;
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (value: PriorityFilter) => void;
}

export function FilterBar({
  transportModes,
  statusFilter,
  onStatusFilterChange,
  modeFilter,
  onModeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
}: FilterBarProps) {
  const modeEntries = Object.entries(transportModes) as [TransportModeKey, TransportMode][];

  const matchCount = stops.filter((stop) => {
    const statusDimmed = statusFilter === "toBook" && stop.booked;
    const modeDimmed = modeFilter !== "all" && modeFilter !== stop.transportTo.mode;
    return !statusDimmed && !modeDimmed;
  }).length;

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

        <p className="shrink-0 text-xs font-medium text-ink-soft sm:ml-auto">
          {matchCount} van {stops.length} komen overeen
        </p>
      </div>
    </div>
  );
}
