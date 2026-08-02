import type { TransportLeg, TransportMode } from "../types/trip";

interface TransportConnectorProps {
  leg: TransportLeg;
  mode: TransportMode;
  dimmed: boolean;
}

export function TransportConnector({ leg, mode, dimmed }: TransportConnectorProps) {
  return (
    <div
      className={`relative flex items-center gap-3 py-3 pl-12 transition-opacity duration-300 sm:pl-16 ${
        dimmed ? "opacity-30" : "opacity-100"
      }`}
    >
      <span
        aria-hidden
        className="absolute left-[1.35rem] top-0 h-full w-px sm:left-[1.6rem]"
        style={{
          backgroundImage:
            mode.style === "dashed"
              ? `linear-gradient(${mode.color}, ${mode.color} 60%, transparent 0%)`
              : undefined,
          backgroundColor: mode.style === "dashed" ? undefined : mode.color,
          backgroundSize: mode.style === "dashed" ? "2px 8px" : undefined,
          backgroundRepeat: "repeat-y",
        }}
      />
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base shadow-sm"
        style={{ backgroundColor: `${mode.color}1a`, color: mode.color }}
      >
        {mode.icon}
      </span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium text-ink-soft">{leg.label}</span>
        <span className="text-ink-soft/60">·</span>
        <span className="text-ink-soft">{leg.duration}</span>
        {leg.warn && (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-xs font-medium text-terracotta-dark">
            ⚠ {leg.warn}
          </span>
        )}
      </div>
    </div>
  );
}
