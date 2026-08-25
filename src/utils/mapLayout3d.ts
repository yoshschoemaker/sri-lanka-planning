import type { LabelDirection, Stop } from "../types/trip";
import { projectToWorld, type WorldPoint } from "./projection3d";

/**
 * The 3D equivalent of mapLayout.ts, reading the same per-stop `map` block from
 * content/trip.json.
 *
 * Nudges are needed for the same reason as in 2D: negombo-arrival and
 * negombo-departure share identical lat/lon, so without one their pins and Html
 * badges land exactly on top of each other. Label directions almost never are —
 * only one 3D label is visible at a time (hover/focus/selection), so the
 * permanent south-coast collisions of the flat map don't exist here.
 */

/** World position for a stop's marker, its own nudge applied. */
export function getMarkerWorldPosition(stop: Pick<Stop, "lat" | "lon" | "map">): WorldPoint {
  const base = projectToWorld(stop.lat, stop.lon);
  const nudge = stop.map?.nudge3d;
  return nudge ? { x: base.x + nudge.dx, z: base.z + nudge.dz } : base;
}

export type { LabelDirection };

/** Which way the expanded name label opens. Right by default; "left" is the escape hatch for a stop whose label would run off the canvas or across its neighbours. */
export function getLabelDirection(stop: Pick<Stop, "map">): LabelDirection {
  return stop.map?.label3d ?? "right";
}
