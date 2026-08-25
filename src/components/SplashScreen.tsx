import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";
import { isStandaloneDisplay } from "../utils/pwaDisplayMode";
import { useDialog } from "../utils/useDialog";
import { PalmIcon } from "./icons";

const HOLD_MS = 1300;
const EXIT_MS = 550;
/** Exported so DailyCountdownConfetti.tsx can wait its own flourish out until this is fully gone, instead of the two overlays competing on first load. */
export const SPLASH_TOTAL_MS = HOLD_MS + EXIT_MS;

const DOT_COUNT = 3;

/**
 * A brief native-app-style launch screen: title, then a fade into the real
 * page. Not tied to any real loading state (the app has none worth waiting
 * on) — it's a fixed-length branding beat, kept short so it reads as
 * "polished" rather than "in the way". Skipped entirely under
 * prefers-reduced-motion rather than shortened, since it's pure flourish.
 *
 * Also skipped when running as an installed app: iOS cold-starts a home-screen
 * app whenever it has been backgrounded for a while, so this beat would show up
 * many times a day there — and iOS already shows its own launch image first,
 * which would make this a second splash on top of the first.
 */
export function SplashScreen() {
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !prefersReducedMotion && !isStandaloneDisplay());

  // De scroll-lock loopt via useDialog, met trapFocus uit: dit is een
  // branding-beat en geen dialoog, dus hij mag de focus niet opeisen. Wel via
  // die hook, omdat die de locks stapelt: de oude versie zette bij het opruimen
  // `overflow` hard terug op "" en kon zo de lock van een dialoog die er
  // ondertussen bovenop was geopend opheffen.
  useDialog({ open: visible, onClose: () => setVisible(false), trapFocus: false });

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), HOLD_MS);
    // No StrictMode-safe cleanup concerns here (unlike DailyCountdownConfetti):
    // both the dev-only double-invoke's phantom run and the real run schedule
    // the identical safe timer, so the cleanup below is a plain, correct effect
    // cleanup rather than something the double-invoke can break.
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          /*
            Volledig verborgen voor hulptechnologie: dit is een branding-beat van
            1,3 seconde zonder informatie, en hij hangt buiten elk landmark. Een
            schermlezer hoort nu meteen de echte pagina in plaats van eerst een
            losse titel die daarna verdwijnt.
          */
          aria-hidden
          className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-cream"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: EXIT_MS / 1000, ease: "easeInOut" }}
        >
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <PalmIcon className="h-8 w-8 text-terracotta-dark" />
            <p className="font-serif text-3xl font-semibold tracking-wide text-ink sm:text-4xl">
              Sri Lanka <span className="text-terracotta-dark">2027</span>
            </p>
            <motion.span
              aria-hidden
              className="h-px w-12 bg-terracotta-dark/50"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              style={{ transformOrigin: "center" }}
            />
            <div className="mt-1 flex gap-1.5">
              {Array.from({ length: DOT_COUNT }, (_, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-terracotta-dark/50"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
