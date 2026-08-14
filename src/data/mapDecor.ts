import type { WorldPoint } from "../utils/projection3d";

/**
 * Hand-placed world positions for the 3D map's decorative props and named
 * landmarks. These lived in TripMap3D.tsx until the procedural vegetation
 * scatter needed to read them too (to keep trees off the props that are already
 * there) — importing them from the component that renders them would have made
 * a cycle, so they live in data/ now, comments and all.
 *
 * All coordinates are scene world space (x = east, z = south), matching
 * src/utils/projection3d.ts's projectToWorld output.
 */

/** Empty coastal/inland spots the stop/daytrip/route layout never touches, so these purely decorative elements never collide with real UI. */
export const PALM_TREE_POSITIONS: WorldPoint[] = [
  { x: 1.55, z: 0.75 }, // east coast, Trincomalee-ish
  { x: -1.0, z: 3.95 }, // south coast dunes near Mirissa/Hikkaduwa
  { x: 0.15, z: -2.6 }, // northern peninsula — real palmyra-palm country
];

/** Sampled around the whole coastline (offset outward from the coastline ring, verified in water), spaced so no two crowd the same stretch of coast. */
export const WAVE_CREST_POSITIONS: WorldPoint[] = [
  { x: 2.4, z: 0.85 }, // east coast
  { x: 0.3, z: 4.7 }, // open water south of the island, off the surf coast
  { x: 2.64, z: 1.96 }, // northeast coast
  { x: 0.98, z: 4.06 }, // south coast
  { x: -1.0, z: 4.53 }, // south coast, near Mirissa/Hikkaduwa
  { x: -1.89, z: 3.25 }, // southwest coast
  { x: -2.22, z: 1.91 }, // west coast
  { x: -2.66, z: -0.45 }, // west coast, north of Negombo
  { x: -2.11, z: -2.55 }, // northwest coast
  { x: -1.39, z: -3.82 }, // near the northern peninsula
  { x: -0.08, z: -3.48 }, // north tip
  { x: 0.49, z: -2.83 }, // northeast coast
  { x: 1.15, z: -2.06 }, // northeast coast
  { x: 1.67, z: -0.53 }, // east coast, north of Trincomalee
];

export const STUPA_POSITION: WorldPoint = { x: -0.15, z: -1.9 }; // north of the Anuradhapura marker, clear of its pin/label
export const LEOPARD_POSITION: WorldPoint = { x: -1.3, z: -1.65 }; // near the Wilpattu daytrip marker, clear of its dot
export const ELEPHANT_POSITION: WorldPoint = { x: 1.55, z: 2.65 }; // near the Yala stop marker, clear of its pin

/** Temple of the Tooth (Kandy) and the Dambulla cave temple daytrip — both real temple visits, so they get Temple.tsx's tiered-roof vihara rather than Stupa.tsx's dagoba dome. */
export const TEMPLE_POSITIONS: WorldPoint[] = [
  { x: -0.15, z: 1.42 }, // Kandy
  { x: -0.38, z: 0.1 }, // Dambulla cave temple daytrip
];

// Each nudged further offshore from the coastline ring than they first were
// (the local coast sits at z≈3.58/4.08/4.34 respectively at these x's) — they
// were reading as beached rather than swimming.
export const FISH_SCHOOL_POSITION: WorldPoint = { x: -1.65, z: 4.15 }; // just off Hikkaduwa's Coral Sanctuary snorkel spot
export const TURTLE_POSITION: WorldPoint = { x: 0.28, z: 4.45 }; // off the south coast near Hiriketiya, by Rekawa's turtle beach
export const WHALE_POSITION: WorldPoint = { x: -0.4, z: 4.85 }; // open water south of Mirissa, where the whale-watching boats actually go (kept just inside the camera's default framing)
export const SIGIRIYA_ROCK_POSITION: WorldPoint = { x: 0.45, z: -0.03 }; // east of the Sigiriya marker, clear of both its pin circle and the Dambulla temple nearby

/**
 * Nine Arches Bridge, on the real Demodara loop southeast of Ella — the viaduct
 * the train ride everyone books this trip for actually crosses. The real
 * coordinates (6.876N, 81.061E) project to almost exactly the Ella stop marker,
 * so this is nudged 0.3 units southeast: the direction the real bridge lies in,
 * and onto the tier-2 shelf right where the terrain drops off eastward (tier 3-4
 * to the west, tier 0 to the east), which is a plausible thing for a viaduct to
 * span.
 */
export const NINE_ARCHES_POSITION: WorldPoint = { x: 0.92, z: 2.32 };
/**
 * Rotation (radians) around Y for the viaduct's span. Chosen so the span runs
 * roughly perpendicular to the default camera's view direction ([5.7, 11.6,
 * 16.2] looking at the origin), i.e. the arches are seen side-on rather than
 * end-on — which for a nine-arch bridge is the entire point of modelling it.
 */
export const NINE_ARCHES_ROTATION = 0.34;

/**
 * Galle Fort, the UNESCO rampart town that's Hikkaduwa's daytrip. Real
 * coordinates put it right on the coastline ring (0.01 units from the edge,
 * where it would overhang the island's bevel), so it's pulled very slightly
 * inland to ~0.07. Its own daytrip dot sits 0.1 away, which reads as that dot
 * labelling this fort; the coastal route line passing along its landward side is
 * what the real Galle Road does too.
 */
export const GALLE_FORT_POSITION: WorldPoint = { x: -1.19, z: 4.06 };

/**
 * Ravana Falls, the roadside waterfall below Ella on the Wellawaya road. Sits on
 * a genuine escarpment in the terrain data: tier 3 here, tier 6 barely 0.14
 * units north, tier 1 the same distance south — so the fall has real height to
 * drop, and the component measures that drop from the terrain rather than
 * assuming it.
 */
export const WATERFALL_POSITION: WorldPoint = { x: 0.49, z: 2.5 };
/** Which way the fall faces (radians around Y). 0 = facing +z (south), which is downhill here; a slight offset stops it reading as axis-aligned. */
export const WATERFALL_ROTATION = 0.18;

/**
 * Radius, in world units, that each kind of existing prop claims for itself.
 * The scatter treats these as exclusion zones so a procedurally placed tree
 * never grows through the stupa or out of the Lion Rock.
 */
export const PROP_CLEARANCE = {
  palmTree: 0.16,
  stupa: 0.3,
  temple: 0.22,
  sigiriyaRock: 0.28,
  critter: 0.24,
  landmark: 0.45,
  waterfall: 0.3,
} as const;
