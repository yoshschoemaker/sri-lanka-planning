import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Stop, Trip } from "../types/trip";
import { buildTripChecklist } from "../utils/checklist";
import { useChecklistProgress } from "../utils/checklistProgress";
import { dimTransition } from "../motion/variants";
import { TripChecklist } from "./TripChecklist";
import { PracticalNotes } from "./PracticalNotes";
import { CheckIcon, ChevronIcon, NotebookIcon } from "./icons";

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
  const progress = useChecklistProgress();
  const panelId = "trip-info-panel";

  // De badge telt wat er nog open staat, niet wat er in totaal op de lijst
  // stond: ingeklapt is "nog 4 te doen" de enige informatie die je hier wil.
  const allKeys = [...checklist.toBook, ...checklist.toArrange, ...checklist.warnings, ...checklist.questions].map(
    (item) => item.key,
  );
  const openCount = checklist.totalCount - progress.doneCount(allKeys);

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
          <NotebookIcon className="h-4 w-4 shrink-0 text-ink-soft" />
          Reisinfo &amp; nog te regelen
        </span>
        <span className="flex items-center gap-3">
          {openCount > 0 ? (
            <span
              className="rounded-full bg-terracotta-dark/10 px-2.5 py-0.5 text-xs font-medium text-terracotta-dark"
              aria-label={`${openCount} nog te doen`}
            >
              {openCount}
            </span>
          ) : (
            checklist.totalCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-forest-dark"
                aria-label="Alles afgevinkt"
              >
                <CheckIcon className="h-3 w-3" />
                Klaar
              </span>
            )
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
              <TripChecklist checklist={checklist} progress={progress} onJumpToStop={onJumpToStop} />
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
