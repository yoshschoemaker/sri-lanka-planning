import type { ChecklistItem, TripChecklist as TripChecklistData } from "../utils/checklist";

interface TripChecklistProps {
  checklist: TripChecklistData;
  onJumpToStop: (id: string) => void;
}

/** Renders the three checklist groups only; the surrounding card/header lives in TripInfoAccordion so this stays reusable. */
export function TripChecklist({ checklist, onJumpToStop }: TripChecklistProps) {
  return (
    <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
      <ChecklistGroup title="Boekingen" icon="🧳" items={checklist.toBook} onJumpToStop={onJumpToStop} />
      <ChecklistGroup title="Te regelen" icon="📋" items={checklist.toArrange} onJumpToStop={onJumpToStop} />
      <ChecklistGroup title="Let op" icon="⚠" items={checklist.warnings} onJumpToStop={onJumpToStop} />
      <ChecklistGroup title="Nog te bespreken" icon="?" items={checklist.questions} onJumpToStop={onJumpToStop} />
    </div>
  );
}

function ChecklistGroup({
  title,
  icon,
  items,
  onJumpToStop,
}: {
  title: string;
  icon: string;
  items: ChecklistItem[];
  onJumpToStop: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <span aria-hidden>{icon}</span>
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            {item.stopId ? (
              <button
                type="button"
                onClick={() => onJumpToStop(item.stopId!)}
                className="group flex w-full items-start gap-1.5 rounded-lg text-left text-sm text-ink outline-none hover:text-terracotta-dark"
              >
                <span aria-hidden className="mt-0.5 shrink-0 text-terracotta">
                  ○
                </span>
                <span className="min-w-0 flex-1">
                  <span className="underline decoration-terracotta/40 underline-offset-2 group-hover:decoration-terracotta-dark">
                    {item.label}
                  </span>
                  {item.detail && <span className="ml-1.5 text-xs text-ink-soft">{item.detail}</span>}
                </span>
              </button>
            ) : (
              <p className="flex items-start gap-1.5 text-sm text-ink-soft">
                <span aria-hidden className="mt-0.5 shrink-0 text-terracotta">
                  ○
                </span>
                <span className="min-w-0 flex-1">
                  {item.label}
                  {item.detail && <span className="ml-1.5 text-xs">{item.detail}</span>}
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
