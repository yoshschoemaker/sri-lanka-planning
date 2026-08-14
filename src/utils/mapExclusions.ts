import { buildRouteCurve } from "../components/map3d/RouteLine3D";
import { MAHAWELI_POINTS, MAHAWELI_WIDTH, WATER_BODIES } from "../data/inlandWater";
import {
  ELEPHANT_POSITION,
  GALLE_FORT_POSITION,
  LEOPARD_POSITION,
  NINE_ARCHES_POSITION,
  PALM_TREE_POSITIONS,
  PROP_CLEARANCE,
  SIGIRIYA_ROCK_POSITION,
  STUPA_POSITION,
  TEMPLE_POSITIONS,
  WATERFALL_POSITION,
} from "../data/mapDecor";
import type { Stop } from "../types/trip";
import { getDaytripEntries } from "./daytrips";
import { getMarkerWorldPosition } from "./mapLayout3d";
import { projectToWorld } from "./projection3d";
import type { Exclusion } from "./scatter3d";

/**
 * Keep-out radii, in world units, for everything the procedural scatter must
 * not grow through. Derived from what each thing actually occupies on screen
 * rather than guessed: a stop marker is a pin plus a numbered <Html> badge that
 * expands into a name label on hover, so it claims noticeably more room than the
 * pin geometry alone suggests.
 */
const STOP_CLEARANCE = 0.42;
const DAYTRIP_CLEARANCE = 0.3;
/** Narrow: a route line is a 0.028-radius tube, and the point is only that trees don't grow through it. */
const ROUTE_CLEARANCE = 0.11;
/** How many points to sample along each route curve. 20 at the longest leg's ~3 world units is a sample every ~0.15, comfortably tighter than ROUTE_CLEARANCE, so the chain of circles has no gaps. */
const ROUTE_SAMPLES = 20;
/** Extra margin beyond a lake's own radius, so trees stand on the bank rather than in the shallows. */
const WATER_MARGIN = 0.03;
/** Samples along the river. Its own half-width is only ~0.045, so the circles have to be close together to form a continuous corridor. */
const RIVER_SAMPLES = 40;

/**
 * Every circular keep-out area on the island, built from the live trip data
 * rather than a hand-maintained list — add a stop or a daytrip and the
 * vegetation moves out of its way on the next render.
 */
export function buildMapExclusions(stops: Stop[]): Exclusion[] {
  const exclusions: Exclusion[] = [];

  for (const stop of stops) {
    const { x, z } = getMarkerWorldPosition(stop);
    exclusions.push({ x, z, r: STOP_CLEARANCE });
  }

  for (const { activity } of getDaytripEntries(stops)) {
    const { x, z } = projectToWorld(activity.lat, activity.lon);
    exclusions.push({ x, z, r: DAYTRIP_CLEARANCE });
  }

  // Sampled along the real curve (the same one RouteLine3D and Train3D ride)
  // rather than along the straight line between endpoints, since that curve
  // bows away from the chord over the hill country.
  for (let i = 1; i < stops.length; i++) {
    const curve = buildRouteCurve(getMarkerWorldPosition(stops[i - 1]), getMarkerWorldPosition(stops[i]));
    for (let s = 0; s <= ROUTE_SAMPLES; s++) {
      const point = curve.getPointAt(s / ROUTE_SAMPLES);
      exclusions.push({ x: point.x, z: point.z, r: ROUTE_CLEARANCE });
    }
  }

  for (const body of WATER_BODIES) {
    exclusions.push({ x: body.x, z: body.z, r: body.radius + WATER_MARGIN });
  }

  // The river as a chain of circles along a straight-segment approximation of its
  // spline. Approximating rather than rebuilding the CatmullRom here is
  // deliberate: the corridor only has to be wide enough that no tree grows out of
  // the water, and the spline's deviation from its own control polygon is well
  // under the margin below.
  for (let i = 1; i < MAHAWELI_POINTS.length; i++) {
    const from = MAHAWELI_POINTS[i - 1];
    const to = MAHAWELI_POINTS[i];
    const segmentSamples = Math.ceil(RIVER_SAMPLES / (MAHAWELI_POINTS.length - 1));
    for (let s = 0; s <= segmentSamples; s++) {
      const t = s / segmentSamples;
      // Widen with the river itself, using the same start-to-end fraction the
      // ribbon's taper uses.
      const along = (i - 1 + t) / (MAHAWELI_POINTS.length - 1);
      exclusions.push({
        x: from.x + (to.x - from.x) * t,
        z: from.z + (to.z - from.z) * t,
        r: MAHAWELI_WIDTH.start + (MAHAWELI_WIDTH.end - MAHAWELI_WIDTH.start) * along + WATER_MARGIN,
      });
    }
  }

  for (const p of PALM_TREE_POSITIONS) exclusions.push({ ...p, r: PROP_CLEARANCE.palmTree });
  for (const p of TEMPLE_POSITIONS) exclusions.push({ ...p, r: PROP_CLEARANCE.temple });
  exclusions.push({ ...STUPA_POSITION, r: PROP_CLEARANCE.stupa });
  exclusions.push({ ...SIGIRIYA_ROCK_POSITION, r: PROP_CLEARANCE.sigiriyaRock });
  exclusions.push({ ...LEOPARD_POSITION, r: PROP_CLEARANCE.critter });
  exclusions.push({ ...ELEPHANT_POSITION, r: PROP_CLEARANCE.critter });
  exclusions.push({ ...NINE_ARCHES_POSITION, r: PROP_CLEARANCE.landmark });
  exclusions.push({ ...GALLE_FORT_POSITION, r: PROP_CLEARANCE.landmark });
  exclusions.push({ ...WATERFALL_POSITION, r: PROP_CLEARANCE.waterfall });

  return exclusions;
}
