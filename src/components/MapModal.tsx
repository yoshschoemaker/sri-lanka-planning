import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Stop, TransportMode, TransportModeKey } from "../types/trip";
import type { ModeFilter, StatusFilter } from "./FilterBar";
import { TripMapScene } from "./TripMapScene";
import { useReducedMotion } from "../utils/useReducedMotion";
import { CloseIcon } from "./icons";

interface MapModalProps {
  open: boolean;
  onClose: () => void;
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: string | null;
  onSelect: (id: string) => void;
  onTourSelect: (id: string) => void;
  statusFilter: StatusFilter;
  modeFilter: ModeFilter;
}

/**
 * Mobile-only full-screen presentation of the map (lg:hidden — desktop
 * already has the always-visible sticky panel). Replaces the old
 * scrollIntoView-to-the-inline-map jump, which always landed back at the top
 * of the page: App.tsx now saves/restores the itinerary scroll position
 * around open/close instead, so dismissing this never loses your place.
 */
export function MapModal({ open, onClose, ...mapProps }: MapModalProps) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col bg-cream lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
        >
          <div className="pt-safe px-safe shrink-0">
            <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
              <span className="font-serif text-lg font-semibold text-ink">Kaart</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Kaart sluiten"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-ink/5 active:scale-95"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="pb-safe px-safe relative flex-1">
            <TripMapScene variant="hero" {...mapProps} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
