import type { Stop } from "../types/trip";
import { project } from "./projection";

/**
 * negombo-arrival and negombo-departure share identical lat/lon. A small
 * visual-only nudge on the departure marker keeps both clickable and
 * readable instead of stacking exactly on top of each other.
 */
const MARKER_NUDGE: Record<string, { dx: number; dy: number }> = {
  "negombo-departure": { dx: 20, dy: 22 },
};

export function getMarkerPosition(stop: Stop): { x: number; y: number } {
  const { x, y } = project(stop.lat, stop.lon);
  const nudge = MARKER_NUDGE[stop.id];
  return nudge ? { x: x + nudge.dx, y: y + nudge.dy } : { x, y };
}

export type LabelAnchor = "start" | "middle" | "end";

export interface LabelPlacement {
  dx: number;
  dy: number;
  anchor: LabelAnchor;
}

/** Per-stop label placement so names stay on-canvas and never collide. */
const LABEL_OVERRIDES: Record<string, LabelPlacement> = {
  "negombo-arrival": { dx: 0, dy: -16, anchor: "middle" },
  "negombo-departure": { dx: 0, dy: 22, anchor: "middle" },
  // Tangalle / Mirissa / Hikkaduwa sit close together on the south coast;
  // default right-side labels would overlap, so each is nudged to its own spot.
  tangalle: { dx: 14, dy: 18, anchor: "start" },
  mirissa: { dx: 0, dy: 20, anchor: "middle" },
};

const DEFAULT_LABEL: LabelPlacement = { dx: 14, dy: 4, anchor: "start" };

export function getLabelPlacement(stop: Stop): LabelPlacement {
  return LABEL_OVERRIDES[stop.id] ?? DEFAULT_LABEL;
}
