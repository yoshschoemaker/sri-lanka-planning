import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Stop, TransportMode } from "../types/trip";
import { dimTransition } from "../motion/variants";
import { PhotoGallery, CameraIcon } from "./PhotoGallery";
import { AccommodationCard } from "./AccommodationCard";
import { ActivityCard } from "./ActivityCard";
import { isStopover, nightsLabel } from "../utils/nights";
import type { PriorityFilter } from "./FilterBar";

interface StopCardProps {
  stop: Stop;
  order: number;
  mode: TransportMode;
  isActive: boolean;
  dimmed: boolean;
  priorityFilter: PriorityFilter;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

/** Two or more must-see activities marks a stop as a trip highlight, worth a bit more visual weight than a pass-through stay. */
const HIGHLIGHT_MUST_COUNT = 2;

export function StopCard({ stop, order, mode, isActive, dimmed, priorityFilter, onSelect, registerRef }: StopCardProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const coverPhoto = stop.photos?.[0] ?? stop.accommodation?.photos?.[0];
  const panelId = `stop-${stop.id}-panel`;
  const isHighlight = stop.activities.filter((activity) => activity.priority === "must").length >= HIGHLIGHT_MUST_COUNT;
  const stopover = isStopover(stop);

  return (
    <motion.div
      ref={(el: HTMLDivElement | null) => registerRef(stop.id, el)}
      id={`stop-${stop.id}`}
      layout
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onClick={() => onSelect(stop.id)}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      aria-label={`Stop ${order}: ${stop.name}${stopover ? ", tussenstop zonder overnachting" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(stop.id);
        }
      }}
      className="scroll-mt-24 cursor-pointer rounded-2xl outline-none"
    >
      {/*
        Dimming lives on this inner element rather than the outer whileInView
        one above: Framer Motion resolves whileInView above animate when both
        target the same property, so once a card has scrolled into view its
        whileInView opacity would permanently win and filter-dimming could
        never take effect again on that card. It wraps both the bordered card
        and the loose activity strip below so a filtered-out stop dims as one
        unit, even though the activities aren't inside the card's own box.
      */}
      <motion.div animate={{ opacity: dimmed ? 0.4 : 1 }} transition={dimTransition} className="flex flex-col gap-2.5">
        <div
          className={`rounded-2xl border bg-white/70 p-5 shadow-card transition-colors duration-300 sm:p-6 ${
            // Een doortocht krijgt een gestippelde rand: hij hoort in de route,
            // maar is geen verblijf zoals de omliggende kaarten.
            stopover ? "border-dashed" : ""
          } ${
            isActive
              ? "border-terracotta-dark shadow-glow-terracotta ring-2 ring-terracotta/40"
              : isHighlight
                ? "border-terracotta-light/60 hover:border-terracotta-light"
                : "border-ink/10 hover:border-terracotta-light"
          }`}
        >
          <div className="flex items-start gap-4">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold transition-colors ${
                isActive ? "bg-terracotta-dark text-white" : isHighlight ? "bg-terracotta-light/30 text-ink" : "bg-sand text-ink"
              }`}
              aria-hidden
            >
              {order}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="flex items-center gap-2 font-serif text-xl font-semibold text-ink sm:text-2xl">
                  {stop.name}
                  {isHighlight && (
                    <span
                      aria-label="Hoogtepunt van de reis"
                      title="Hoogtepunt van de reis"
                      className="text-base text-terracotta-dark sm:text-lg"
                    >
                      ✨
                    </span>
                  )}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    stopover
                      ? "bg-ink/5 text-ink-soft"
                      : stop.booked
                        ? "bg-forest/10 text-forest-dark"
                        : "bg-terracotta/10 text-terracotta-dark"
                  }`}
                >
                  {stopover ? "⏱ Tussenstop" : stop.booked ? "✓ Geboekt" : "○ Nog te boeken"}
                </span>
              </div>

              <p className="mt-1 text-sm text-ink-soft">
                {stop.dates} · {nightsLabel(stop)}
              </p>

              {/*
                Het verblijf staat ook ingeklapt op de kaart: bij het plannen wil
                je in één blik zien waar je slaapt, zonder elke stop open te
                klappen. De uitklap houdt de volledige kaart met foto's en link.
              */}
              {!stopover &&
                (stop.accommodation ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink">
                    <span aria-hidden>🛏</span>
                    <span className="min-w-0 truncate font-medium">{stop.accommodation.name}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-soft">
                    <span aria-hidden>🛏</span>
                    <span>Verblijf nog niet gekozen</span>
                  </p>
                ))}

              {stop.note && <p className="mt-2 text-sm text-ink-soft">{stop.note}</p>}

              {stop.warn && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-terracotta/10 px-2.5 py-1.5 text-xs font-medium text-terracotta-dark">
                  ⚠ {stop.warn}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <span aria-hidden style={{ color: mode.color }}>
                    {mode.icon}
                  </span>
                  {stopover ? "onderweg via" : "aangekomen via"} {mode.label.toLowerCase()}
                </p>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPanelOpen((prev) => !prev);
                  }}
                  aria-expanded={panelOpen}
                  aria-controls={panelId}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink-soft outline-none transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  {stopover ? "Foto's" : "Foto's & verblijf"}
                  <ChevronIcon expanded={panelOpen} className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl border sm:h-16 sm:w-16 ${
                isHighlight ? "border-terracotta-light" : "border-ink/10"
              }`}
            >
              {coverPhoto ? (
                <img src={coverPhoto} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-sand/60">
                  <CameraIcon className="h-5 w-5 text-ink-soft/40" />
                </div>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {panelOpen && (
              <motion.div
                key="panel"
                id={panelId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={dimTransition}
                className="overflow-hidden"
              >
                <div className="mt-4 flex flex-col gap-4 border-t border-ink/10 pt-4">
                  <PhotoGallery photos={stop.photos} alt={stop.name} />
                  {!stopover && <AccommodationCard accommodation={stop.accommodation} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {stop.activities.length > 0 && (
          <motion.ul
            variants={listVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="flex flex-col gap-2"
          >
            {stop.activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                dimmed={priorityFilter !== "all" && activity.priority !== priorityFilter}
              />
            ))}
          </motion.ul>
        )}
      </motion.div>
    </motion.div>
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
