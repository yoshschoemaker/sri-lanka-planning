import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Stop, Trip } from "../types/trip";
import { dimTransition } from "../motion/variants";
import { isStopover, nightsLabel } from "../utils/nights";

interface RouteSummaryProps {
  trip: Trip;
  stops: Stop[];
}

interface SummaryLine {
  key: string;
  label: string;
  detail: string;
}

/** Name first, then dates + nights. No transport or activities: this is the "waar en wanneer" overzicht, niets meer. */
function buildLines({ trip, stops }: RouteSummaryProps): SummaryLine[] {
  const { outbound, return: inbound } = trip.flights;

  return [
    { key: "flight-out", label: "Vlucht heen", detail: `${outbound.date} · ${outbound.from} → ${outbound.to}` },
    ...stops.map((stop) => ({
      key: stop.id,
      label: isStopover(stop) ? `${stop.name} (tussenstop)` : stop.name,
      detail: `${stop.dates} · ${nightsLabel(stop)}`,
    })),
    { key: "flight-back", label: "Vlucht terug", detail: `${inbound.date} · ${inbound.from} → ${inbound.to}` },
  ];
}

/** Collapsed by default, net als de reisinfo-sectie: het is een naslag-overzicht, geen blokkade voor de route eronder. */
export function RouteSummary({ trip, stops }: RouteSummaryProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelId = "route-summary-panel";

  if (stops.length === 0) return null;

  const lines = buildLines({ trip, stops });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lines.map((line) => `${line.label} · ${line.detail}`).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permission denied): the text is
      // on screen anyway, so selecting it by hand still works.
    }
  };

  return (
    <section className="mt-12 mb-10 rounded-2xl border border-ink/10 bg-white/60 sm:mt-14">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left outline-none sm:px-6"
      >
        <span className="inline-flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <span aria-hidden>📋</span>
          Samenvatting
        </span>
        <ChevronIcon expanded={open} className="h-4 w-4 shrink-0 text-ink-soft" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={panelId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={dimTransition}
            className="overflow-hidden"
          >
            <div className="border-t border-ink/10 px-5 py-5 sm:px-6">
              <ul className="flex flex-col gap-1 text-sm text-ink-soft">
                {lines.map((line) => (
                  <li key={line.key}>
                    <span className="text-ink">{line.label}</span> · {line.detail}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-4 rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink-soft transition-colors active:scale-95"
              >
                {copied ? "Gekopieerd" : "Kopieer"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""} ${className ?? ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
