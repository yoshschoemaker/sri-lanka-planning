import type { WorldPoint } from "../utils/projection3d";
import rawDecor from "../../content/decor.json";

/**
 * What stands loose on the 3D island: landmarks, animals and trees, read from
 * content/decor.json.
 *
 * All coordinates are scene world space (x = east, z = south), matching
 * src/utils/projection3d.ts's projectToWorld output — not lat/lon. That's a
 * deliberate trade: these are placed by eye against the terrain (a fort has to
 * clear the coastline bevel, a waterfall needs a real escarpment under it), and
 * a projected lat/lon lands them a fraction off in exactly the way that reads
 * as wrong.
 *
 * The list lives in data/ rather than in the component that renders it because
 * the procedural vegetation scatter reads it too, to keep trees from growing
 * through whatever is already standing there (see utils/mapExclusions.ts).
 */

/** Every decor kind the 3D scene knows how to render. Adding a new one means adding a component and an entry in decorRegistry.tsx; placing more of an existing one is a JSON edit. */
export const DECOR_TYPES = [
  "palmTree",
  "stupa",
  "temple",
  "sigiriyaRock",
  "nineArches",
  "galleFort",
  "waterfall",
  "leopard",
  "elephant",
  "peacock",
  "fishSchool",
  "turtle",
  "whale",
  "monkeyGrove",
] as const;

export type DecorType = (typeof DECOR_TYPES)[number];

export interface DecorItem {
  type: DecorType;
  /** Absent only for monkeyGrove, which carries `trees` instead. */
  x?: number;
  z?: number;
  /** Rotation around Y in radians. Used by nineArches and waterfall. */
  rotation?: number;
  /** Fireflies around this item. Used by temple. */
  fireflies?: boolean;
  /** monkeyGrove only: the trees in the order the monkey visits them. */
  trees?: WorldPoint[];
  /** Author's note. Never rendered. */
  note?: string;
}

/**
 * Radius, in world units, that each kind of prop claims for itself. The
 * scatter treats these as exclusion zones so a procedurally placed tree never
 * grows through the stupa or out of the Lion Rock.
 */
export interface DecorClearance {
  palmTree: number;
  stupa: number;
  temple: number;
  sigiriyaRock: number;
  monkeyTree: number;
  critter: number;
  peacock: number;
  landmark: number;
  waterfall: number;
}

interface DecorContent {
  clearance: DecorClearance;
  items: DecorItem[];
}

const decor = rawDecor as unknown as DecorContent;

export const PROP_CLEARANCE: DecorClearance = decor.clearance;

export const decorItems: DecorItem[] = decor.items;

/**
 * Which clearance each type claims, or null for the sea creatures — nothing is
 * scattered on water, so they need no keep-out circle. The grove is keyed by
 * its individual trees rather than the group.
 */
export const DECOR_CLEARANCE_KEY: Record<DecorType, keyof DecorClearance | null> = {
  palmTree: "palmTree",
  stupa: "stupa",
  temple: "temple",
  sigiriyaRock: "sigiriyaRock",
  nineArches: "landmark",
  galleFort: "landmark",
  waterfall: "waterfall",
  leopard: "critter",
  elephant: "critter",
  peacock: "peacock",
  monkeyGrove: "monkeyTree",
  fishSchool: null,
  turtle: null,
  whale: null,
};

/** All placements of one kind, as plain points. A grove yields each of its trees. */
export function getDecorPoints(type: DecorType): WorldPoint[] {
  return decorItems.flatMap((item) => {
    if (item.type !== type) return [];
    if (item.trees) return item.trees;
    return item.x == null || item.z == null ? [] : [{ x: item.x, z: item.z }];
  });
}

/** First item of a kind, for the places that genuinely only ever have one (the Kandy temple's fireflies). */
export function getDecorItem(type: DecorType): DecorItem | undefined {
  return decorItems.find((item) => item.type === type);
}

if (import.meta.env.DEV) {
  const known = new Set<string>(DECOR_TYPES);
  for (const item of decorItems) {
    if (!known.has(item.type)) {
      console.warn(`[decor] Onbekend type "${item.type}". Bekende types: ${DECOR_TYPES.join(", ")}`);
    } else if (item.type === "monkeyGrove") {
      if (!item.trees || item.trees.length < 2) console.warn("[decor] monkeyGrove heeft minstens twee bomen nodig");
    } else if (item.x == null || item.z == null) {
      console.warn(`[decor] "${item.type}" mist x/z`);
    }
  }
}
