import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";
import { iosInstallRoute, isIpad } from "../utils/pwaDisplayMode";
import { AddToHomeScreenIcon, CloseIcon, IosShareIcon } from "./icons";

interface IosInstallSheetProps {
  open: boolean;
  onClose: () => void;
}

interface Step {
  icon?: ReactNode;
  text: ReactNode;
}

/**
 * iOS kent geen beforeinstallprompt: installeren kan daar uitsluitend handmatig
 * via het deelmenu. Deze sheet wijst de weg, omdat die route anders onvindbaar
 * is voor wie hem niet kent. Sinds iOS 16.4 kunnen ook Chrome, Edge en Firefox
 * de actie tonen, alleen zit de deelknop daar elders.
 */
export function IosInstallSheet({ open, onClose }: IosInstallSheetProps) {
  const prefersReducedMotion = useReducedMotion();
  const route = iosInstallRoute();

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

  const shareStep: Step = {
    icon: <IosShareIcon className="h-5 w-5" />,
    text:
      route === "share-sheet" ? (
        <>
          Tik naast de adresbalk op <strong className="font-semibold">Deel</strong>
        </>
      ) : isIpad() ? (
        <>
          Tik rechtsboven in Safari op <strong className="font-semibold">Deel</strong>
        </>
      ) : (
        <>
          Tik onderin in Safari op <strong className="font-semibold">Deel</strong>
        </>
      ),
  };

  const steps: Step[] = [
    shareStep,
    {
      icon: <AddToHomeScreenIcon className="h-5 w-5" />,
      text: (
        <>
          Scroll omlaag en kies{" "}
          <strong className="font-semibold">Zet op beginscherm</strong>
        </>
      ),
    },
    {
      text: (
        <>
          Tik rechtsboven op <strong className="font-semibold">Voeg toe</strong>
        </>
      ),
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Zet op beginscherm"
        >
          <div className="absolute inset-0 bg-ink/60" />

          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="pb-safe px-safe relative w-full max-w-md rounded-t-3xl bg-cream shadow-float"
            initial={{ y: prefersReducedMotion ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: prefersReducedMotion ? 0 : "100%" }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: "easeOut" }}
          >
            <div className="px-6 pb-8 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-ink">
                    Zet op je beginscherm
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    Dan opent de planning als app, ook zonder internet.
                  </p>
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

              {route !== "none" ? (
                <ol className="mt-6 space-y-4">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta-dark">
                        {i + 1}
                      </span>
                      <span className="flex flex-1 items-center gap-2 text-sm text-ink">
                        {step.text}
                      </span>
                      {step.icon && (
                        <span className="shrink-0 text-terracotta-dark">{step.icon}</span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-6 rounded-2xl bg-cream-dark px-4 py-3 text-sm text-ink">
                  Open deze pagina in <strong className="font-semibold">Safari</strong>, Chrome of
                  Edge om hem op je beginscherm te kunnen zetten. Vanuit een app zoals Instagram
                  of Facebook lukt dat niet.
                </p>
              )}

              {route === "share-sheet" && (
                <p className="mt-5 rounded-2xl bg-cream-dark px-4 py-3 text-sm text-ink-soft">
                  Staat <strong className="font-semibold">Zet op beginscherm</strong> er niet
                  tussen? Scroll in het deelmenu helemaal omlaag, tik op{" "}
                  <strong className="font-semibold">Wijzig acties</strong> en zet hem daar aan.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
