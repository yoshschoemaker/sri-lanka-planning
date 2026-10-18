import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";
import { useServiceWorker } from "../utils/serviceWorkerContext";
import { CloseIcon } from "./icons";

const OFFLINE_TOAST_MS = 4000;

/**
 * Toont de update-flow. Het bijwerken zelf gebeurt automatisch in
 * ServiceWorkerProvider, op een moment dat je er geen last van hebt. Ben je
 * bezig, dan meldt deze toast dat er een versie klaarstaat, met de optie om
 * meteen te vernieuwen. Na de reload volgt een korte "bijgewerkt"-melding.
 */
interface UpdatePromptProps {
  /** Schuift de toast boven de install-banner, die dezelfde onderrand bezet. */
  raised?: boolean;
}

export function UpdatePrompt({ raised = false }: UpdatePromptProps) {
  const prefersReducedMotion = useReducedMotion();
  const {
    needRefresh,
    justUpdated,
    dismissJustUpdated,
    offlineReady,
    dismissOfflineReady,
    applyUpdate,
  } = useServiceWorker();
  // "Later" verbergt alleen de toast; de update gaat nog steeds door zodra je
  // de app wegklikt.
  const [refreshDismissed, setRefreshDismissed] = useState(false);
  const showRefresh = needRefresh && !refreshDismissed;

  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(dismissOfflineReady, OFFLINE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [offlineReady, dismissOfflineReady]);

  useEffect(() => {
    if (!justUpdated) return;
    const timer = setTimeout(dismissJustUpdated, OFFLINE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [justUpdated, dismissJustUpdated]);

  const show = showRefresh || justUpdated || offlineReady;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pb-safe px-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center"
          style={raised ? { marginBottom: "8.5rem" } : undefined}
          initial={{ y: prefersReducedMotion ? 0 : "110%", opacity: prefersReducedMotion ? 0 : 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: prefersReducedMotion ? 0 : "110%", opacity: prefersReducedMotion ? 0 : 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: "easeOut" }}
          role="status"
        >
          <div className="pointer-events-auto m-3 flex w-full max-w-md items-center gap-3 rounded-2xl border border-ink/10 bg-cream px-4 py-3 shadow-float">
            {showRefresh ? (
              <>
                <p className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold">Nieuwe versie beschikbaar.</span>{" "}
                  <span className="text-ink-soft">Laadt vanzelf als je de app wegklikt.</span>
                </p>
                <button
                  type="button"
                  onClick={() => setRefreshDismissed(true)}
                  className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-ink/5 active:scale-95"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={applyUpdate}
                  className="shrink-0 rounded-full bg-terracotta-dark px-4 py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95"
                >
                  Vernieuwen
                </button>
              </>
            ) : justUpdated ? (
              <>
                <p className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold">App bijgewerkt.</span>{" "}
                  <span className="text-ink-soft">Je hebt nu de nieuwste versie.</span>
                </p>
                <button
                  type="button"
                  onClick={dismissJustUpdated}
                  aria-label="Sluiten"
                  className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-ink/5 active:scale-95"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold">Klaar voor offline gebruik.</span>{" "}
                  <span className="text-ink-soft">De hele planning staat op je toestel.</span>
                </p>
                <button
                  type="button"
                  onClick={dismissOfflineReady}
                  aria-label="Sluiten"
                  className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-ink/5 active:scale-95"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
