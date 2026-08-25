import type { ChecklistItem, TripChecklist as TripChecklistData } from "../utils/checklist";
import type { ChecklistProgress } from "../utils/checklistProgress";
import type { ReactNode } from "react";
import { CheckIcon, ClipboardIcon, QuestionIcon, SuitcaseIcon, WarningIcon } from "./icons";

interface TripChecklistProps {
  checklist: TripChecklistData;
  progress: ChecklistProgress;
  onJumpToStop: (id: string) => void;
}

/** Renders the three checklist groups only; the surrounding card/header lives in TripInfoAccordion so this stays reusable. */
export function TripChecklist({ checklist, progress, onJumpToStop }: TripChecklistProps) {
  return (
    <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
      <ChecklistGroup title="Boekingen" icon={<SuitcaseIcon className="h-3.5 w-3.5" />} items={checklist.toBook} progress={progress} onJumpToStop={onJumpToStop} />
      <ChecklistGroup title="Te regelen" icon={<ClipboardIcon className="h-3.5 w-3.5" />} items={checklist.toArrange} progress={progress} onJumpToStop={onJumpToStop} />
      <ChecklistGroup title="Let op" icon={<WarningIcon className="h-3.5 w-3.5" />} items={checklist.warnings} progress={progress} onJumpToStop={onJumpToStop} />
      <ChecklistGroup title="Nog te bespreken" icon={<QuestionIcon className="h-3.5 w-3.5" />} items={checklist.questions} progress={progress} onJumpToStop={onJumpToStop} />
    </div>
  );
}

function ChecklistGroup({
  title,
  icon,
  items,
  progress,
  onJumpToStop,
}: {
  title: string;
  icon: ReactNode;
  items: ChecklistItem[];
  progress: ChecklistProgress;
  onJumpToStop: (id: string) => void;
}) {
  if (items.length === 0) return null;

  const done = progress.doneCount(items.map((item) => item.key));

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <span aria-hidden>{icon}</span>
        {title}
        <span className="ml-auto font-mono tracking-normal tabular-nums">
          {done}/{items.length}
        </span>
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <ChecklistRow key={item.key} item={item} progress={progress} onJumpToStop={onJumpToStop} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Eén regel met twee losse doelen: het vinkje links vinkt af, de tekst ernaast
 * springt naar de bijbehorende stop. Die twee zijn opzettelijk niet één knop —
 * "dit is geregeld" en "laat me deze stop zien" zijn verschillende bedoelingen,
 * en één gecombineerde klik zou steeds de verkeerde van de twee raden.
 */
function ChecklistRow({
  item,
  progress,
  onJumpToStop,
}: {
  item: ChecklistItem;
  progress: ChecklistProgress;
  onJumpToStop: (id: string) => void;
}) {
  const done = progress.isDone(item.key);

  return (
    <li className="flex items-start gap-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={() => progress.toggle(item.key)}
        aria-label={done ? `"${item.label}" weer openzetten` : `"${item.label}" afvinken`}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
          done
            ? "border-forest bg-forest text-cream"
            : "border-terracotta/50 text-transparent hover:border-terracotta hover:bg-terracotta/10"
        }`}
      >
        <CheckIcon className="h-2.5 w-2.5" />
      </button>

      <span className={`min-w-0 flex-1 text-sm transition-opacity ${done ? "text-ink-soft opacity-55" : "text-ink"}`}>
        {item.stopId ? (
          <button
            type="button"
            onClick={() => onJumpToStop(item.stopId!)}
            /*
              Expliciet label in plaats van de zichtbare tekst. Label en detail
              staan naast elkaar als twee inline-spans, en de accessible-name
              berekening trimt per node: die las "Kandyma 1 tot wo 3 feb" aan
              elkaar. Bovendien zegt dit wat de knop dóet, want de zichtbare
              tekst is een plaatsnaam met een datum, geen actie.
            */
            aria-label={`Naar ${item.label}${item.detail ? `, ${item.detail}` : ""}`}
            className="group text-left outline-none hover:text-terracotta-dark"
          >
            <span
              className={`underline decoration-terracotta/40 underline-offset-2 group-hover:decoration-terracotta-dark ${
                done ? "line-through decoration-ink-soft/50" : ""
              }`}
            >
              {item.label}
            </span>
            {item.detail && <span className="ml-1.5 text-xs text-ink-soft">{item.detail}</span>}
          </button>
        ) : (
          <>
            <span className={done ? "line-through decoration-ink-soft/50" : ""}>{item.label}</span>
            {item.detail && <span className="ml-1.5 text-xs text-ink-soft">{item.detail}</span>}
          </>
        )}
      </span>
    </li>
  );
}
