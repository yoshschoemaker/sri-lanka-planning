import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";
import { useServiceWorker } from "../utils/serviceWorkerContext";
import { CloseIcon } from "./icons";

const OFFLINE_TOAST_MS = 4000;

/**
 * Toont de update-flow. De registratie zelf en de periodieke controle zitten in
 * ServiceWorkerProvider; met registerType "prompt" wisselt de nieuwe versie pas
 * na een expliciete klik, zodat de app niet midden in het gebruik onder je
 * vandaan wordt vervangen.
 */
interface UpdatePromptProps {
  /** Schuift de toast boven de install-banner, die dezelfde onderrand bezet. */
  raised?: boolean;
}

export function UpdatePrompt({ raised = false }: UpdatePromptProps) {
  const prefersReducedMotion = useReducedMotion();
  const {
    needRefresh,
    dismissRefresh,
    offlineReady,
    dismissOfflineReady,
    applyUpdate,
  } = useServiceWorker();

  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(dismissOfflineReady, OFFLINE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [offlineReady, dismissOfflineReady]);

  const show = needRefresh || offlineReady;

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
            {needRefresh ? (
              <>
                <p className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold">Nieuwe versie beschikbaar.</span>{" "}
                  <span className="text-ink-soft">Vernieuw om hem te laden.</span>
                </p>
                <button
                  type="button"
                  onClick={dismissRefresh}
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
