import type { LabelAnchor, Stop } from "../types/trip";
import { project } from "./projection";

/**
 * Where a stop's marker and name sit on the flat map.
 *
 * Both fall out of lat/lon by default. The corrections live on the stop itself
 * in content/trip.json (`map.nudge2d` / `map.label2d`) rather than in a lookup
 * table here, so the two stops that need one — Negombo appears twice at
 * identical coordinates, and Hiriketiya/Mirissa/Hikkaduwa crowd the south coast
 * — are fixed where the rest of the stop is authored.
 */
export function getMarkerPosition(stop: Pick<Stop, "lat" | "lon" | "map">): { x: number; y: number } {
  const { x, y } = project(stop.lat, stop.lon);
  const nudge = stop.map?.nudge2d;
  return nudge ? { x: x + nudge.dx, y: y + nudge.dy } : { x, y };
}

export type { LabelAnchor };

export interface LabelPlacement {
  dx: number;
  dy: number;
  anchor: LabelAnchor;
}

const DEFAULT_LABEL: LabelPlacement = { dx: 14, dy: 4, anchor: "start" };

export function getLabelPlacement(stop: Pick<Stop, "map">): LabelPlacement {
  return stop.map?.label2d ?? DEFAULT_LABEL;
}
