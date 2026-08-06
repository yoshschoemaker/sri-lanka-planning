import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion language: the timing/shape used across Header, StopCard and
 * TripMap today, formalized so map and UI animations stay in lockstep. The
 * flat numeric constants are the part a future canvas/WebGL scene would
 * import too (material opacity lerps and camera-move durations can't consume
 * Framer Motion's DOM-oriented Variants objects, but they can share the same
 * numbers).
 */
export const ENTRANCE_DURATION = 0.6;
export const SELECT_PULSE_DURATION = 2;
export const DIM_DURATION = 0.3;

export const fadeUpTransition: Transition = { duration: ENTRANCE_DURATION, ease: "easeOut" };

/** Entrance: fade + rise into place. Pair with `staggerContainer` on the parent. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: fadeUpTransition },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

/** Hover/tap: the scale nudge used on map markers. */
export const hoverLift = { scale: 1.12 };
export const tapShrink = { scale: 0.95 };

/** Selection: the pulsing ring drawn around an active map marker. */
export const selectPulse: Variants = {
  idle: { scale: 1, opacity: 0.6 },
  pulse: {
    scale: [1, 1.18, 1],
    opacity: [0.6, 0.15, 0.6],
    transition: { duration: SELECT_PULSE_DURATION, repeat: Infinity, ease: "easeInOut" },
  },
};

/** Dim: filtered-out map/list items fading back rather than disappearing. */
export const dimTransition: Transition = { duration: DIM_DURATION };
