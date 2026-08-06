/** List content only; the surrounding card/header lives in TripInfoAccordion so this stays reusable. */
export function PracticalNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;

  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <span aria-hidden>ℹ</span>
        Praktisch
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {notes.map((note) => (
          <li key={note} className="flex items-start gap-2 text-sm text-ink-soft">
            <span aria-hidden className="mt-0.5">
              ·
            </span>
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}
