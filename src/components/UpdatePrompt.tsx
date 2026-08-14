import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useReducedMotion } from "../utils/useReducedMotion";
import { requestPersistentStorage } from "../utils/persistentStorage";
import { CloseIcon } from "./icons";

/** Hoe vaak een openstaande tab bij de server naar een nieuwe versie vraagt. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const OFFLINE_TOAST_MS = 4000;

/**
 * Registreert de service worker en handelt de update-flow af. Met
 * registerType "prompt" wisselt de nieuwe versie pas na een expliciete klik,
 * zodat de app niet midden in het gebruik onder je vandaan wordt vervangen.
 */
interface UpdatePromptProps {
  /** Schuift de toast boven de install-banner, die dezelfde onderrand bezet. */
  raised?: boolean;
}

export function UpdatePrompt({ raised = false }: UpdatePromptProps) {
  const prefersReducedMotion = useReducedMotion();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, swRegistration) {
      setRegistration(swRegistration ?? null);
      // Pas hier zinvol: vóór de registratie valt er nog geen precache te
      // beschermen. Draait elke start opnieuw tot het systeem ja zegt.
      void requestPersistentStorage();
    },
    onRegisterError(error) {
      console.error("Service worker registratie mislukt:", error);
    },
  });

  useEffect(() => {
    if (!registration) return;

    const check = () => {
      if (navigator.onLine) void registration.update();
    };
    const interval = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    // Een standalone app op iOS draait vaak dagenlang dezelfde sessie door;
    // zonder deze check zie je een update pas na een koude start.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [registration]);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

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
                  onClick={() => setNeedRefresh(false)}
                  className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-ink/5 active:scale-95"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => void updateServiceWorker(true)}
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
                  onClick={() => setOfflineReady(false)}
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
