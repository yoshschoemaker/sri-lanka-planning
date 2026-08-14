import type { Stop } from "../types/trip";
import { projectToWorld, type WorldPoint } from "./projection3d";

/**
 * 3D equivalent of src/utils/mapLayout.ts's MARKER_NUDGE. negombo-arrival and
 * negombo-departure share identical lat/lon, so without a nudge their pins
 * and Html badges would render exactly on top of each other. Nudged toward
 * +x/+z (east/south, into the island interior) rather than further west,
 * which would push it past the coastline at that latitude.
 */
const MARKER_NUDGE_3D: Record<string, { dx: number; dz: number }> = {
  "negombo-departure": { dx: 0.32, dz: 0.3 },
};

/** Id-keyed world position for a stop's marker, id nudges applied. */
export function getMarkerWorldPosition(stop: Pick<Stop, "id" | "lat" | "lon">): WorldPoint {
  const base = projectToWorld(stop.lat, stop.lon);
  const nudge = MARKER_NUDGE_3D[stop.id];
  return nudge ? { x: base.x + nudge.dx, z: base.z + nudge.dz } : base;
}

export type LabelDirection = "left" | "right";

/**
 * Escape hatch for the rare expanded name-label that would clip against the
 * canvas edge in its default direction (expands to the right of the badge).
 * Unlike 2D's LABEL_OVERRIDES, this should almost never be needed: only one
 * 3D label is ever visible at a time (hover/focus/selection), so the
 * Hiriketiya/Mirissa/Hikkaduwa-style permanent collisions don't exist here.
 */
const LABEL_DIRECTION_OVERRIDES: Record<string, LabelDirection> = {
  // Westmost stop, with the rest of the route fanning out east of it — the
  // default rightward expansion drifts straight into that cluster (visibly
  // overlapping stops 3-4) instead of the open water to its west.
  "negombo-arrival": "left",
};

export function getLabelDirection(stopId: string): LabelDirection {
  return LABEL_DIRECTION_OVERRIDES[stopId] ?? "right";
}
