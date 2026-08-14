import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../utils/useReducedMotion";
import { isStandaloneDisplay } from "../utils/pwaDisplayMode";

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

  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => setVisible(false), HOLD_MS);
    // No StrictMode-safe cleanup concerns here (unlike DailyCountdownConfetti):
    // both the dev-only double-invoke's phantom run and the real run schedule
    // the identical safe timer/overflow-lock, so the cleanup below is a plain,
    // correct effect cleanup rather than something the double-invoke can break.
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
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
            <span aria-hidden className="text-3xl">
              🌴
            </span>
            <h1 className="font-serif text-3xl font-semibold tracking-wide text-ink sm:text-4xl">
              Sri Lanka <span className="text-terracotta-dark">2027</span>
            </h1>
            <motion.span
              aria-hidden
              className="h-px w-12 bg-terracotta-dark/50"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              style={{ transformOrigin: "center" }}
            />
            <div className="mt-1 flex gap-1.5" role="status" aria-label="Laden">
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
