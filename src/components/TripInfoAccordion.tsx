import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Stop, Trip } from "../types/trip";
import { buildTripChecklist } from "../utils/checklist";
import { dimTransition } from "../motion/variants";
import { TripChecklist } from "./TripChecklist";
import { PracticalNotes } from "./PracticalNotes";

interface TripInfoAccordionProps {
  trip: Trip;
  stops: Stop[];
  openQuestions: string[];
  todos: string[];
  notes: string[];
  onJumpToStop: (id: string) => void;
}

/** Collapsed by default: todo's and practical notes matter, but the route + map below are the centerpiece and should land in view without scrolling past a wall of text first. */
export function TripInfoAccordion({ trip, stops, openQuestions, todos, notes, onJumpToStop }: TripInfoAccordionProps) {
  const [open, setOpen] = useState(false);
  const checklist = buildTripChecklist(trip, stops, openQuestions, todos);
  const panelId = "trip-info-panel";

  if (checklist.totalCount === 0 && notes.length === 0) return null;

  return (
    <section className="mb-10 rounded-2xl border border-ink/10 bg-white/60">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left outline-none sm:px-6"
      >
        <span className="inline-flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <span aria-hidden>🗒</span>
          Reisinfo &amp; nog te regelen
        </span>
        <span className="flex items-center gap-3">
          {checklist.totalCount > 0 && (
            <span className="rounded-full bg-terracotta-dark/10 px-2.5 py-0.5 text-xs font-medium text-terracotta-dark">
              {checklist.totalCount}
            </span>
          )}
          <ChevronIcon expanded={open} className="h-4 w-4 shrink-0 text-ink-soft" />
        </span>
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
            <div className="flex flex-col gap-6 border-t border-ink/10 px-5 py-5 sm:px-6">
              <TripChecklist checklist={checklist} onJumpToStop={onJumpToStop} />
              {notes.length > 0 && (
                <div className="border-t border-ink/10 pt-5">
                  <PracticalNotes notes={notes} />
                </div>
              )}
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
