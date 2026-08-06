import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Trip } from "../types/trip";
import { getTripStatus } from "../utils/countdown";
import { shouldShowDailyCountdown, markDailyCountdownShown } from "../utils/dailyCountdown";
import { useReducedMotion } from "../utils/useReducedMotion";
import { SPLASH_TOTAL_MS } from "./SplashScreen";

const CONFETTI_COLORS = ["#c2683f", "#e3a67e", "#e7d5ac", "#2f5d4e", "#66bfd1", "#f2ead9"];
const CONFETTI_COUNT = 40;
/** Waits out SplashScreen's own on-screen time (plus a small breather) so the two first-load flourishes play one after another instead of competing for the same frame. */
const START_DELAY_MS = SPLASH_TOTAL_MS + 200;
const TICK_DELAY_MS = 500;
const VISIBLE_DURATION_MS = 2200;

interface ConfettiPiece {
  id: number;
  angle: number;
  distance: number;
  width: number;
  height: number;
  rotate: number;
  color: string;
  delay: number;
}

function createConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, id) => ({
    id,
    angle: Math.random() * Math.PI * 2,
    distance: 90 + Math.random() * 220,
    width: 6 + Math.random() * 6,
    height: 4 + Math.random() * 5,
    rotate: (Math.random() - 0.5) * 720,
    color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
    delay: Math.random() * 0.15,
  }));
}

/**
 * A once-per-calendar-day (per device, via localStorage) "one day closer!"
 * moment: the countdown visibly ticks down by one with a confetti burst, big
 * and centered, then fades itself out. Purely a delight flourish — the
 * always-visible Header pill already shows the correct number regardless of
 * whether this has fired yet.
 */
export function DailyCountdownConfetti({ trip }: { trip: Trip }) {
  const [visible, setVisible] = useState(false);
  const [displayedDays, setDisplayedDays] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const prefersReducedMotion = useReducedMotion();
  const status = useMemo(() => getTripStatus(trip.start, trip.end), [trip.start, trip.end]);

  useEffect(() => {
    if (status.phase !== "upcoming") return;
    if (!shouldShowDailyCountdown()) return;
    markDailyCountdownShown();
    if (prefersReducedMotion) return; // still marked shown for today — just skip the flourish itself

    // No cleanup on purpose: StrictMode's dev-only mount→cleanup→remount cycle
    // would otherwise cancel these on the phantom cleanup, and the immediate
    // re-run finds shouldShowDailyCountdown() already false (marked above) so
    // it never reschedules them — the tick/hide would silently never fire.
    // This component lives for the app's whole lifetime, so there's no real
    // unmount to worry about outliving.
    setTimeout(() => {
      setConfetti(createConfetti());
      setDisplayedDays(status.daysUntilStart + 1);
      setVisible(true);
      setTimeout(() => setDisplayedDays(status.daysUntilStart), TICK_DELAY_MS);
      setTimeout(() => setVisible(false), VISIBLE_DURATION_MS);
    }, START_DELAY_MS);
    // Deliberately mount-only: this fires at most once per calendar day regardless of later re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {visible && displayedDays !== null && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="absolute inset-0 bg-ink/35" />

          <div className="relative flex items-center justify-center">
            {confetti.map((piece) => (
              <motion.span
                key={piece.id}
                aria-hidden
                className="absolute left-1/2 top-1/2 z-10 rounded-sm"
                style={{ width: piece.width, height: piece.height, backgroundColor: piece.color }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{
                  x: Math.cos(piece.angle) * piece.distance,
                  y: Math.sin(piece.angle) * piece.distance + 90,
                  opacity: 0,
                  rotate: piece.rotate,
                }}
                transition={{ duration: 1.4, delay: piece.delay, ease: "easeOut" }}
              />
            ))}

            <motion.div
              className="relative flex flex-col items-center gap-1 rounded-3xl bg-cream px-10 py-8 text-center shadow-2xl"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: "backOut" }}
            >
              <span className="font-serif text-sm font-semibold uppercase tracking-[0.3em] text-terracotta-dark">
                Nog
              </span>
              <div className="relative h-20 w-40 overflow-hidden sm:h-24 sm:w-48">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={displayedDays}
                    className="absolute inset-0 flex items-center justify-center font-serif text-7xl font-bold text-ink sm:text-8xl"
                    initial={{ y: 44, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -44, opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  >
                    {displayedDays}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span className="text-base text-ink-soft">{displayedDays === 1 ? "dag te gaan!" : "dagen te gaan!"}</span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
