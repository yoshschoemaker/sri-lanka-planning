import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePwaInstall } from "../utils/usePwaInstall";
import { useReducedMotion } from "../utils/useReducedMotion";
import { SPLASH_TOTAL_MS } from "./SplashScreen";
import { IosInstallSheet } from "./IosInstallSheet";
import { CloseIcon, DownloadIcon } from "./icons";

/** Extra rust na de splash en de dagelijkse countdown, zodat de banner niet in de drukte valt. */
const APPEAR_DELAY_MS = SPLASH_TOTAL_MS + 1500;

interface InstallPromptProps {
  /** App.tsx schuift de kaart-FAB omhoog zolang de banner de onderkant bezet. */
  onVisibilityChange?: (visible: boolean) => void;
}

export function InstallPrompt({ onVisibilityChange }: InstallPromptProps) {
  const prefersReducedMotion = useReducedMotion();
  const { state, promptInstall, snooze, snoozed } = usePwaInstall();
  const [delayPassed, setDelayPassed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDelayPassed(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const canInstall = state === "installable" || state === "ios-manual";
  const visible = canInstall && delayPassed && !snoozed && !dismissed;

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  async function handleInstall() {
    if (state === "ios-manual") {
      setSheetOpen(true);
      return;
    }
    const outcome = await promptInstall();
    // Bij "dismissed" is het deferred event op: Chrome geeft pas bij een volgend
    // bezoek een nieuwe kans, dus de banner heeft nu geen functie meer.
    if (outcome !== "accepted") setDismissed(true);
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="pb-safe px-safe fixed inset-x-0 bottom-0 z-30 flex justify-center"
            initial={{ y: prefersReducedMotion ? 0 : "110%", opacity: prefersReducedMotion ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: prefersReducedMotion ? 0 : "110%", opacity: prefersReducedMotion ? 0 : 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: "easeOut" }}
            role="region"
            aria-label="App installeren"
          >
            <div className="m-3 w-full max-w-md rounded-2xl border border-ink/10 bg-cream px-4 py-3.5 shadow-float">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terracotta/15 text-terracotta-dark">
                  <DownloadIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base font-semibold leading-snug text-ink">
                    Zet de reisplanning op je beginscherm
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Werkt ook zonder internet onderweg.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  aria-label="Sluiten"
                  className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-ink/5 active:scale-95"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={snooze}
                  className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-ink/5 active:scale-95"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={handleInstall}
                  className="rounded-full bg-terracotta-dark px-4 py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95"
                >
                  {state === "ios-manual" ? "Hoe doe ik dat?" : "Installeren"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <IosInstallSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
