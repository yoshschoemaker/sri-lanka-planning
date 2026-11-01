import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";
import { useDialog } from "../utils/useDialog";
import { CloseIcon } from "./icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Paneel dat op mobiel van onderen inschuift en op desktop in het midden staat.
 * Zelfde vorm als SettingsSheet; gebruikt door de formulieren voor de gedeelde
 * activiteiten.
 */
export function Sheet({ open, onClose, title, subtitle, children }: SheetProps) {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useDialog<HTMLDivElement>({ open, onClose });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="absolute inset-0 bg-ink/60" />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="pb-safe px-safe relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream shadow-float outline-none sm:m-4 sm:rounded-3xl"
            initial={{ y: prefersReducedMotion ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: prefersReducedMotion ? 0 : "100%" }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: "easeOut" }}
          >
            <div className="px-6 pb-8 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
                  {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Sluiten"
                  className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-ink/5 active:scale-95"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Invoerveld met label, in de stijl van de sheets. */
export function SheetField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export const INPUT_CLASS_NAME =
  "mt-1.5 block w-full rounded-xl border border-ink/15 bg-white/80 px-3.5 py-2.5 text-base text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-terracotta focus:ring-2 focus:ring-terracotta/30";

export const PRIMARY_BUTTON_CLASS_NAME =
  "shrink-0 rounded-full bg-terracotta-dark px-4 py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95 disabled:opacity-60";
