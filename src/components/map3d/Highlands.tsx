import { useMemo } from "react";
import * as THREE from "three";
import { TERRAIN_BANDS } from "../../data/terrainBands";
import type { WorldPoint } from "../../utils/projection3d";
import { addRadialGradient, ISLAND_TOP_Y } from "./Island";

const BASE_TOP_CENTER = new THREE.Color("#c2b877");
const BASE_TOP_EDGE = new THREE.Color("#9c8a4f");
const BASE_SIDE_COLOR = new THREE.Color("#6e5c34");

const PEAK_TOP_CENTER = new THREE.Color("#8f9478");
const PEAK_TOP_EDGE = new THREE.Color("#68705a");
const PEAK_SIDE_COLOR = new THREE.Color("#4f5442");

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

function pointInRing(x: number, z: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
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
  let tier = -1;
  for (let i = 0; i < TERRAIN_BANDS.length; i++) {
    if (TERRAIN_BANDS[i].rings.some((ring) => pointInRing(x, z, ring))) tier = i;
  }
  return ISLAND_TOP_Y + (tier + 1) * TIER_HEIGHT;
}

function buildRingGeometry(
  ring: readonly (readonly [number, number])[],
  centerColor: THREE.Color,
  edgeColor: THREE.Color,
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
          geometries: band.rings.map((ring) => buildRingGeometry(ring, centerColor, edgeColor)),
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
