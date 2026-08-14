import { projectToWorld } from "./projection3d";

/**
 * Sri Lanka is split into a wet zone (the southwest quarter plus the central
 * highlands, ~2500mm+ of rain, rainforest and rubber and tea) and a dry zone
 * (the whole north and east, ~1200mm, thorn scrub and palmyra palms and the
 * ancient irrigation tanks that exist precisely because it doesn't rain enough).
 * That boundary is the strongest single fact about how the island looks, and the
 * diorama currently ignores it entirely: one flat ochre plateau.
 *
 * Rather than baking a fifth generated data file, this reconstructs the real
 * boundary analytically. The actual wet/dry line runs from Puttalam on the west
 * coast, southeast past Kurunegala and around the north side of the hill
 * country, out to the Hambantota corner: so it's modelled here as the signed
 * distance from exactly that line, plus an orographic bonus for elevation,
 * since the highlands intercept the southwest monsoon (which is why the wet
 * zone bulges inland over Kandy and Ella, and why the eastern lee is so dry).
 *
 * Both the vegetation scatter and the terrain vertex tint read this same
 * function, so green forest always lands on green ground.
 */

/** The real wet/dry boundary's two coastal endpoints: Puttalam (west) and Hambantota (southeast). */
const BOUNDARY_FROM = projectToWorld(8.03, 79.83);
const BOUNDARY_TO = projectToWorld(6.12, 81.12);

/**
 * Unit normal of that boundary line, pointing toward the dry side (northeast).
 * Derived from the projected anchors rather than hardcoded, so it stays correct
 * if PROJECTION or WORLD_SCALE ever changes.
 */
const DRY_AXIS = (() => {
  const dx = BOUNDARY_TO.x - BOUNDARY_FROM.x;
  const dz = BOUNDARY_TO.z - BOUNDARY_FROM.z;
  const length = Math.hypot(dx, dz);
  // Rotating the boundary direction by 90° gives (-dz, dx), which for this
  // pair points southwest (into the wet zone), so negate to face the dry side.
  return { x: dz / length, z: -dx / length };
})();

/**
 * Where the transition runs, as signed distance along DRY_AXIS in world units.
 * Calibrated against real places' distances from the boundary line: Negombo and
 * the whole southwest coast sit at -0.7 or lower, Anuradhapura and Sigiriya at
 * +1.4/+1.6, Jaffna and the east coast beyond +2.3.
 */
const TRANSITION_START = -1;
const TRANSITION_END = 1.6;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** How much wetness the highest tier can claw back on the dry side of the line. */
const MAX_ELEVATION_BONUS = 0.55;

/**
 * 0 = fully dry zone, 1 = fully wet zone, for a world (x, z).
 *
 * `tier` is the terrain tier index at that point (-1 on the lowlands, as
 * returned by Highlands' getTerrainTier); passing it is what makes the wet zone
 * bulge inland over the hill country instead of following a straight diagonal.
 * Callers that genuinely don't know the elevation can omit it and get the
 * lowland gradient. Sanity-checked against real climate: Negombo/Galle/Mirissa
 * come out ~1.0, Kandy at tier 3 ~0.67, Ella at tier 4 ~0.68, Yala ~0.11,
 * Anuradhapura ~0.02, Jaffna/Trincomalee ~0.
 */
export function getWetness(x: number, z: number, tier = -1): number {
  const along = (x - BOUNDARY_FROM.x) * DRY_AXIS.x + (z - BOUNDARY_FROM.z) * DRY_AXIS.z;
  const base = 1 - smoothstep(TRANSITION_START, TRANSITION_END, along);
  // Strongest on the mid slopes where the real montane rainforest sits. Applied
  // to the *remaining* dryness rather than added flat, so it can never push an
  // already-wet lowland past 1 and needs no clamp of its own.
  const elevationBonus = tier < 0 ? 0 : Math.min(MAX_ELEVATION_BONUS, (tier + 1) * 0.11);
  return base + elevationBonus * (1 - base);
}
