import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";
import { isStandaloneDisplay } from "../utils/pwaDisplayMode";
import { APP_COMMIT, APP_VERSION, formatBuildTime, formatCheckTime } from "../utils/appVersion";
import { useServiceWorker } from "../utils/serviceWorkerContext";
import { CheckIcon, CloseIcon, RefreshIcon } from "./icons";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Klein instellingenpaneel: welke versie draait er, en staat er een nieuwe
 * klaar. De automatische controle loopt op de achtergrond (zie
 * serviceWorkerContext), maar onderweg wil je zelf kunnen forceren dat de app
 * kijkt of er een nieuwe planning is.
 */
export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const prefersReducedMotion = useReducedMotion();
  const { needRefresh, applyUpdate, checkForUpdate, checkState, lastCheckedAt, offlineAvailable } =
    useServiceWorker();
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || typeof navigator === "undefined" || !navigator.storage?.persisted) return;
    let active = true;
    void navigator.storage
      .persisted()
      .then((result) => {
        if (active) setStoragePersisted(result);
      })
      .catch(() => {
        if (active) setStoragePersisted(null);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const checking = checkState === "checking";
  const updateReady = needRefresh || checkState === "update-found";

  const statusMessage = updateReady
    ? "Nieuwe versie klaar om te laden."
    : checking
      ? "Controleren…"
      : checkState === "up-to-date"
        ? "Je gebruikt de nieuwste versie."
        : checkState === "offline"
          ? "Geen internetverbinding. Probeer het opnieuw zodra je weer online bent."
          : checkState === "unsupported"
            ? "Deze browser houdt de app niet zelf bij. Herlaad de pagina om te vernieuwen."
            : checkState === "error"
              ? "Controle mislukt. Probeer het straks nog eens."
              : lastCheckedAt
                ? `Laatst gecontroleerd ${formatCheckTime(lastCheckedAt)}.`
                : "De app controleert zelf elk uur op een nieuwe versie.";

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
          aria-label="Instellingen"
        >
          <div className="absolute inset-0 bg-ink/60" />

          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="pb-safe px-safe relative w-full max-w-md rounded-t-3xl bg-cream shadow-float sm:m-4 sm:rounded-3xl"
            initial={{ y: prefersReducedMotion ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: prefersReducedMotion ? 0 : "100%" }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: "easeOut" }}
          >
            <div className="px-6 pb-8 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-ink">Instellingen</h2>
                  <p className="mt-1 text-sm text-ink-soft">Versie en updates van de app.</p>
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

              <dl className="mt-5 space-y-2 rounded-2xl bg-cream-dark px-4 py-3.5 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Versie</dt>
                  <dd className="font-medium text-ink">
                    {APP_VERSION}{" "}
                    <span className="font-mono text-xs text-ink-soft">({APP_COMMIT})</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Build</dt>
                  <dd className="text-right font-medium text-ink">{formatBuildTime()}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Offline</dt>
                  <dd className="font-medium text-ink">
                    {offlineAvailable ? "Beschikbaar" : "Nog niet opgeslagen"}
                  </dd>
                </div>
                {storagePersisted !== null && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-soft">Opslag</dt>
                    <dd className="font-medium text-ink">
                      {storagePersisted ? "Beveiligd" : "Kan opgeruimd worden"}
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Weergave</dt>
                  <dd className="font-medium text-ink">
                    {isStandaloneDisplay() ? "Als app" : "In de browser"}
                  </dd>
                </div>
              </dl>

              <p
                className={`mt-4 flex items-start gap-2 text-sm ${
                  updateReady ? "text-terracotta-dark" : "text-ink-soft"
                }`}
                role="status"
                aria-live="polite"
              >
                {checkState === "up-to-date" && !updateReady && (
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                )}
                <span>{statusMessage}</span>
              </p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={checkForUpdate}
                  disabled={checking}
                  className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-ink/5 active:scale-95 disabled:opacity-60"
                >
                  <RefreshIcon className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
                  {checking ? "Controleren…" : "Controleer op updates"}
                </button>
                {updateReady && (
                  <button
                    type="button"
                    onClick={applyUpdate}
                    className="shrink-0 rounded-full bg-terracotta-dark px-4 py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95"
                  >
                    Vernieuwen
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
