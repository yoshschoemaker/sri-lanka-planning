import type { Stop } from "../types/trip";
import { project } from "./projection";

/**
 * Stop 1 (arrival) and stop 10 (departure) are both Negombo, i.e. identical
 * lat/lon. A small visual-only nudge on the departure marker keeps both
 * clickable and readable instead of stacking exactly on top of each other.
 */
const MARKER_NUDGE: Record<number, { dx: number; dy: number }> = {
  10: { dx: 20, dy: 22 },
};

export function getMarkerPosition(stop: Stop): { x: number; y: number } {
  const { x, y } = project(stop.lat, stop.lon);
  const nudge = MARKER_NUDGE[stop.n];
  return nudge ? { x: x + nudge.dx, y: y + nudge.dy } : { x, y };
}

export type LabelAnchor = "start" | "middle" | "end";

export interface LabelPlacement {
  dx: number;
  dy: number;
  anchor: LabelAnchor;
}

/** Per-stop label placement so names stay on-canvas and never collide. */
const LABEL_OVERRIDES: Record<number, LabelPlacement> = {
  1: { dx: 0, dy: -16, anchor: "middle" },
  10: { dx: 0, dy: 22, anchor: "middle" },
};

const DEFAULT_LABEL: LabelPlacement = { dx: 14, dy: 4, anchor: "start" };

export function getLabelPlacement(stop: Stop): LabelPlacement {
  return LABEL_OVERRIDES[stop.n] ?? DEFAULT_LABEL;
}
