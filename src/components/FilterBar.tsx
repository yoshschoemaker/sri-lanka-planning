import type { TransportModeKey, TransportMode } from "../types/trip";

export type StatusFilter = "all" | "toBook";
export type ModeFilter = TransportModeKey | "all";

interface FilterBarProps {
  transportModes: Record<TransportModeKey, TransportMode>;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  modeFilter: ModeFilter;
  onModeFilterChange: (value: ModeFilter) => void;
}

export function FilterBar({
  transportModes,
  statusFilter,
  onStatusFilterChange,
  modeFilter,
  onModeFilterChange,
}: FilterBarProps) {
  const modeEntries = Object.entries(transportModes) as [TransportModeKey, TransportMode][];

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={statusFilter === "toBook"}
        onClick={() => onStatusFilterChange(statusFilter === "toBook" ? "all" : "toBook")}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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

      <div className="inline-flex flex-wrap gap-1 rounded-full border border-ink/15 bg-white/60 p-1">
        <button
          type="button"
          aria-pressed={modeFilter === "all"}
          onClick={() => onModeFilterChange("all")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
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
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              modeFilter === key ? "text-white" : "text-ink-soft hover:bg-ink/5"
            }`}
            style={modeFilter === key ? { backgroundColor: mode.color } : undefined}
          >
            <span aria-hidden>{mode.icon}</span>
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
