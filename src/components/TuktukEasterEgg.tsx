import { useEffect, useState } from "react";
import { TUKTUK_EASTER_EGG_EVENT } from "../utils/tuktukEasterEgg";
import { useDialog } from "../utils/useDialog";
import { TuktukScreen } from "./TuktukScreen";
import { CloseIcon } from "./icons";

/**
 * Het tuktuk-scherm als verborgen extraatje: het opent schermvullend zodra
 * iemand de geparkeerde tuktuk op de 3D-kaart aantikt.
 */
export function TuktukEasterEgg() {
  const [open, setOpen] = useState(false);
  const panelRef = useDialog<HTMLDivElement>({ open, onClose: () => setOpen(false) });

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(TUKTUK_EASTER_EGG_EVENT, handleOpen);
    return () => window.removeEventListener(TUKTUK_EASTER_EGG_EVENT, handleOpen);
  }, []);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Tuktuk leren rijden"
      tabIndex={-1}
      className="pt-safe px-safe fixed inset-0 z-50 overflow-y-auto bg-cream outline-none"
    >
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/60 px-3.5 py-1.5 text-sm font-medium text-ink-soft transition hover:text-ink active:scale-95"
        >
          <CloseIcon className="h-4 w-4" />
          Terug naar de kaart
        </button>
        <TuktukScreen />
      </main>
    </div>
  );
}
