import { useMemo } from "react";
import * as THREE from "three";
import { TERRAIN_BANDS } from "../../data/terrainBands";
import { pointInRing } from "../../utils/geometry3d";
import type { WorldPoint } from "../../utils/projection3d";
import { addRadialGradient, applyZoneTint, ISLAND_TOP_Y } from "./Island";

const BASE_TOP_CENTER = new THREE.Color("#c2b877");
const BASE_TOP_EDGE = new THREE.Color("#9c8a4f");
const BASE_SIDE_COLOR = new THREE.Color("#6e5c34");

const PEAK_TOP_CENTER = new THREE.Color("#8f9478");
const PEAK_TOP_EDGE = new THREE.Color("#68705a");
const PEAK_SIDE_COLOR = new THREE.Color("#4f5442");

/** Hill-country climate tints: tea green on the wet windward slopes, dry olive in the eastern lee. */
const HILL_WET = new THREE.Color("#6f9159");
const HILL_DRY = new THREE.Color("#a89a6c");
/** Weaker than the lowlands', since the per-tier elevation lerp above is already carrying most of this terrain's colour. */
const HILL_ZONE_STRENGTH = 0.32;

/** Each of the 7 real elevation bands (src/data/terrainBands.ts) gets an equally thin slice of this budget, so more bands read as a finer-stepped relief rather than a taller one. */
const TIER_DEPTH = 0.045;
const TIER_BEVEL_THICKNESS = 0.012;
const TIER_HEIGHT = TIER_DEPTH + TIER_BEVEL_THICKNESS;
const TIER_SETTINGS = { depth: TIER_DEPTH, bevelEnabled: true, bevelThickness: TIER_BEVEL_THICKNESS, bevelSize: 0.012, bevelSegments: 2, steps: 1 };

/** The mid-elevation band tea estates actually sit on, real-world (~800m); TripMap3D.tsx sits TeaBushes on top of this tier instead of the base island. */
const TEA_BUSH_THRESHOLD_M = 800;
const teaBushBandIndex = Math.max(0, TERRAIN_BANDS.findIndex((band) => band.thresholdM === TEA_BUSH_THRESHOLD_M));
export const PLATEAU_LAYER1_TOP = (teaBushBandIndex + 1) * TIER_HEIGHT;

/** Centroid of that same mid-elevation band's main ring; TripMap3D.tsx reuses this to place TeaBushes/Stupa reference points. */
export function getPlateauCenter(): WorldPoint {
  const mainRing = TERRAIN_BANDS[teaBushBandIndex].rings.reduce((a, b) => (a.length >= b.length ? a : b));
  const x = mainRing.reduce((sum, [px]) => sum + px, 0) / mainRing.length;
  const z = mainRing.reduce((sum, [, pz]) => sum + pz, 0) / mainRing.length;
  return { x, z };
}

/**
 * Every terrain ring paired with its bounding box, highest tier first.
 *
 * The bounding boxes are a prefilter, and the ordering an early exit: the tier
 * lookup is called once per candidate point by the vegetation scatter (thousands
 * of times at mount), and walking all 18 rings' ~700 vertices for each of them
 * was the single most expensive thing in that pass. Most points miss most rings
 * entirely — the high tiers are small — so a 4-comparison box test rejects them
 * before any crossing math runs, and because the highest matching tier is the
 * answer, scanning downward lets a hit return immediately.
 */
const RINGS_BY_TIER_DESC = TERRAIN_BANDS.map((band, tier) => ({
  tier,
  rings: band.rings.map((ring) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, z] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    return { ring, minX, maxX, minZ, maxZ };
  }),
})).reverse();

/**
 * Index of the highest terrain tier covering a world (x, z), or -1 on the flat
 * lowlands. Exported alongside getTerrainSurfaceY (which is just this plus the
 * height math) because the scatter's habitat predicates reason in tiers, not
 * in world Y: "tea grows on the mid band", "patana grass only above tier 4".
 */
export function getTerrainTier(x: number, z: number): number {
  for (const band of RINGS_BY_TIER_DESC) {
    for (const b of band.rings) {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      if (pointInRing(x, z, b.ring)) return band.tier;
    }
  }
  return -1;
}

/**
 * Real ground height at a given world (x, z): ISLAND_TOP_Y on the flat
 * lowlands, or the top of the highest terrain tier whose ring actually
 * covers that point. Landmarks placed inland (e.g. Temple.tsx near Kandy,
 * which real-world sits in the hill country) use this instead of assuming
 * flat ISLAND_TOP_Y, so they sit on the terrace they're really on rather
 * than floating above it or sinking into it.
 */
export function getTerrainSurfaceY(x: number, z: number): number {
  return ISLAND_TOP_Y + (getTerrainTier(x, z) + 1) * TIER_HEIGHT;
}

/** Number of real elevation bands, so habitat predicates can express "the top two tiers" without importing TERRAIN_BANDS themselves. */
export const TERRAIN_TIER_COUNT = TERRAIN_BANDS.length;

export { TIER_HEIGHT };

function buildRingGeometry(
  ring: readonly (readonly [number, number])[],
  centerColor: THREE.Color,
  edgeColor: THREE.Color,
  tier: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  ring.forEach(([x, z], i) => {
    const y = -z;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, TIER_SETTINGS);
  geometry.rotateX(-Math.PI / 2);
  addRadialGradient(geometry, centerColor, edgeColor);
  // The hill country gets the same wet/dry treatment as the base island, but
  // pulled toward tea green rather than lowland green, and weaker: the elevation
  // lerp below is already doing most of the colour work up here, and stacking a
  // strong climate tint on top of it flattens the tiers back into one mass.
  // `tier` is passed through so getWetness applies the orographic bonus that makes
  // the wet zone bulge inland over these slopes, exactly as it does for the
  // vegetation standing on them.
  applyZoneTint(geometry, HILL_WET, HILL_DRY, HILL_ZONE_STRENGTH, tier);
  return geometry;
}

function TierPiece({ geometry, sideColor, y }: { geometry: THREE.ExtrudeGeometry; sideColor: THREE.Color; y: number }) {
  return (
    <mesh geometry={geometry} position={[0, y, 0]}>
      <meshStandardMaterial attach="material-0" vertexColors roughness={0.9} flatShading />
      <meshStandardMaterial attach="material-1" color={sideColor} roughness={0.95} flatShading />
    </mesh>
  );
}

/**
 * The main island is a flat plateau (fase 1's "paper diorama" extrusion has
 * no relief), which reads oddly once you know Sri Lanka's interior is
 * dominated by a ~2500m hill country. This stacks one low-poly layer per real
 * elevation band (src/data/terrainBands.ts, 7 bands from 150m up to 1300m+),
 * the same "cut paper contour" technique real topographic paper models use:
 * each layer is a real SRTM contour ring rather than a hand-drawn blob, so
 * the shape, position, and even the secondary southern hill cluster all come
 * straight from Sri Lanka's actual terrain. Adam's Peak, geographically
 * separate from the Horton Plains/Pidurutalagala massif, falls out of the
 * same data as its own small ring in the higher tiers — no special-casing
 * needed.
 */
export function Highlands() {
  const tiers = useMemo(
    () =>
      TERRAIN_BANDS.map((band, i) => {
        const t = TERRAIN_BANDS.length > 1 ? i / (TERRAIN_BANDS.length - 1) : 0;
        const centerColor = BASE_TOP_CENTER.clone().lerp(PEAK_TOP_CENTER, t);
        const edgeColor = BASE_TOP_EDGE.clone().lerp(PEAK_TOP_EDGE, t);
        const sideColor = BASE_SIDE_COLOR.clone().lerp(PEAK_SIDE_COLOR, t);
        return {
          y: ISLAND_TOP_Y + i * TIER_HEIGHT,
          sideColor,
          geometries: band.rings.map((ring) => buildRingGeometry(ring, centerColor, edgeColor, i)),
        };
      }),
    [],
  );

  return (
    <group>
      {tiers.map((tier, i) =>
        tier.geometries.map((geometry, j) => (
          <TierPiece key={`${i}-${j}`} geometry={geometry} sideColor={tier.sideColor} y={tier.y} />
        )),
      )}
    </group>
  );
}
