import { useMemo } from "react";
import * as THREE from "three";
import { ISLAND_MAIN_RING, ISLAND_ISLET_RINGS, ISLAND_INLAND_RINGS } from "../../data/srilankaShape3d";
import { getWetness } from "../../utils/climateZone3d";
import { WATER_CREST_Y, WATER_TROUGH_Y } from "./seaLevel";

/**
 * Low-poly "paper diorama" extrusion: straight line segments only (no spline
 * smoothing keeps the laser-cut look), a shallow bevel for the cut edge, and
 * few bevel segments so the facets stay visible instead of reading as smooth.
 *
 * The island is two stacked slabs rather than one, which is what gives it a
 * shore. The lower one covers the whole coastline and is sand; the upper one
 * covers ISLAND_INLAND_RINGS (the coastline eroded by a per-coast beach width,
 * see scripts/build-map.mjs) and is the green lowland. Highlands.tsx then
 * stacks its elevation tiers on top of that, in the same idiom.
 */

/**
 * Top of the sand shelf, and the number the whole shoreline lives or dies by.
 *
 * Measured against the crest of the swell rather than against mean sea level:
 * all it has to do is stay dry, so the margin is a hair, not a safety buffer. A
 * first pass used 0.13 and the result was a sand plateau standing 0.24 above the
 * water — taller than BEACH_STEP and four times a terrain tier, which made the
 * beach's own outer edge the biggest cliff on the island, exactly the thing the
 * shelf was added to get rid of. At 0.02 the sea comes right up to the sand.
 */
export const ISLAND_BEACH_Y = WATER_CREST_Y + 0.02;

/** Beach to lowland, one cut-paper step. Enough taller than Highlands' TIER_HEIGHT (0.057) that the shoreline reads as the base of the stack rather than as an eighth contour. */
export const BEACH_STEP = 0.09;

/**
 * World-space Y of the island's lowland surface — the anchor markers, routes,
 * props and scatter all hang off. Note this is *not* the ground everywhere any
 * more: out on the beach shelf the ground is ISLAND_BEACH_Y. Use
 * Highlands.getTerrainSurfaceY, which knows about both, unless you specifically
 * mean the lowland plane.
 *
 * Deliberately close to the 0.66 it sat at when the island was one slab. The
 * shore stopped being a cliff by the sea coming up to meet it, not by the land
 * coming down: every prop on the island is sized in world units against this
 * number, so dropping it would have left the palms towering over the hill
 * country and the mountains reading as bumps.
 */
export const ISLAND_TOP_Y = ISLAND_BEACH_Y + BEACH_STEP;

/** Underside of the slab. Below WATER_TROUGH_Y, so no daylight shows beneath the island once the camera drops to its lowest polar angle. */
export const ISLAND_BOTTOM_Y = WATER_TROUGH_Y - 0.03;

/**
 * bevelSize stays at the value the single-slab island already used. Raising it
 * to fake a wider sand ramp is not an option: 45 of the coastline's 176
 * vertices sit under 0.05 world units from a non-adjacent segment, so a bigger
 * offset folds the contour inside out along the crenellated stretches. The
 * ramp comes from the stack's proportions instead.
 */
const BEACH_BEVEL_THICKNESS = 0.06;
const BEACH_EXTRUDE_SETTINGS = {
  // Both bevel bands sit inside the slab's total height, hence the two subtractions.
  depth: ISLAND_BEACH_Y - ISLAND_BOTTOM_Y - 2 * BEACH_BEVEL_THICKNESS,
  bevelEnabled: true,
  bevelThickness: BEACH_BEVEL_THICKNESS,
  bevelSize: 0.05,
  bevelSegments: 2,
  steps: 1,
};

/** depth + bevelThickness === BEACH_STEP, and the bottom bevel buries itself in the sand slab below — the same trick Highlands' tiers use on each other. */
const LOWLAND_EXTRUDE_SETTINGS = {
  depth: BEACH_STEP - 0.02,
  bevelEnabled: true,
  bevelThickness: 0.02,
  bevelSize: 0.02,
  bevelSegments: 2,
  steps: 1,
};

// The four islets are tiny (well under 1 world unit across). Reusing the main
// island's bevel size/depth on something that small makes three.js's bevel
// contour math cross over itself (self-intersecting "spikes"), so islets get
// a flatter, unbevelled extrude scaled to their own footprint instead. They
// come out at beach height: they're sand bars, not lowland.
const ISLET_EXTRUDE_SETTINGS = {
  depth: ISLAND_BEACH_Y - ISLAND_BOTTOM_Y,
  bevelEnabled: false,
  steps: 1,
};

/**
 * Lowland palette. The first pass had this exactly backwards — sand in the
 * middle of the island and terracotta at the sea — which is a large part of why
 * the island read as having no coast at all. Warm ochre where the lowland meets
 * the sand, greening inland; applyZoneTint then pulls the southwest further
 * toward green and the north and east back toward brown on top of it.
 */
const LOWLAND_CENTER_COLOR = new THREE.Color("#93a464");
const LOWLAND_EDGE_COLOR = new THREE.Color("#b0ad6d");
/** The BEACH_STEP riser, read as exposed laterite. Unusually prominent for a side color: it's a continuous band around the whole island, the line that separates green land from sand, so the old #9c5030 was far too saturated at that length. */
const LOWLAND_SIDE_COLOR = "#a9764a";

const DRY_SAND = new THREE.Color("#ecdcb4");
const DRY_SAND_EDGE = new THREE.Color("#dcc08a");
const WET_SAND = new THREE.Color("#b8905f");
/** The submerged toe of the shelf, fading into the lagoon. */
const SHOAL = new THREE.Color("#a8845a");

/** Lowland climate tints: a humid green for the wet southwest, a sandy ochre for the dry north and east. */
const LOWLAND_WET = new THREE.Color("#8fa863");
const LOWLAND_DRY = new THREE.Color("#d8bd8a");
/** Held well below 1: the terrain is a backdrop for markers and route lines, and a fully saturated green would fight them. */
const LOWLAND_ZONE_STRENGTH = 0.45;

type Ring = readonly (readonly [number, number])[];

interface GradientFrame {
  center: THREE.Vector3;
  radius: number;
}

function buildExtrusion(ring: Ring, settings: THREE.ExtrudeGeometryOptions, baseY: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  ring.forEach(([x, z], i) => {
    // The shape is authored in a local XY plane, then rotated -90° around X
    // below to lie flat (Y up). That rotation maps local Y to world -Z, so
    // without this negation the island would render north/south mirrored;
    // pre-negating here lands it back on the intended world Z (north
    // negative, south positive, matching src/utils/projection3d.ts).
    const y = -z;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });

  const geometry = new THREE.ExtrudeGeometry(shape, settings);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, baseY, 0);
  return geometry;
}

/**
 * Fakes a radial center-to-edge color gradient across the top/bottom cap via
 * vertex colors. Shared with Highlands.tsx's plateau layers (different palette,
 * same technique) so the hill-country "elevation bands" read as the same kind
 * of surface as the base island rather than a distinct material.
 *
 * `frame` exists because the gradient defaults to the geometry's *own* bounding
 * sphere, which paints a bullseye on any small piece: the Jaffna lobe is 0.7
 * units across and would sweep the full center-to-edge ramp over it while the
 * main island spreads the same colors over 4.4 units. Pass every piece of one
 * landmass the same frame.
 */
export function addRadialGradient(
  geometry: THREE.ExtrudeGeometry,
  centerColor: THREE.Color = LOWLAND_CENTER_COLOR,
  edgeColor: THREE.Color = LOWLAND_EDGE_COLOR,
  frame?: GradientFrame,
): void {
  let center = frame?.center;
  let radius = frame?.radius;
  if (!center || !radius) {
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    radius = sphere && sphere.radius > 0 ? sphere.radius : 1;
    center = sphere?.center ?? new THREE.Vector3();
  }

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const dx = position.getX(i) - center.x;
    const dz = position.getZ(i) - center.z;
    const t = Math.min(Math.sqrt(dx * dx + dz * dz) / radius, 1);
    tmp.copy(centerColor).lerp(edgeColor, t ** 1.4);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

/**
 * Ramps existing vertex colors by world Y through a list of ascending stops,
 * leaving anything at or above the last stop untouched.
 *
 * This is how the beach gets its wet/dry gradient, and it has to be the side
 * wall rather than the top cap: ExtrudeGeometry triangulates a cap as an earcut
 * over the contour, so every single cap vertex lies exactly *on* the coastline.
 * A distance-to-coast gradient painted on the cap would come out uniformly wet.
 */
export function addVerticalGradient(
  geometry: THREE.ExtrudeGeometry,
  stops: readonly { y: number; color: THREE.Color }[],
): void {
  const position = geometry.attributes.position;
  const colorAttribute = geometry.attributes.color as THREE.BufferAttribute | undefined;
  if (!colorAttribute || stops.length < 2) return;

  const top = stops[stops.length - 1];
  const tmp = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y >= top.y) continue;
    if (y <= stops[0].y) {
      colorAttribute.setXYZ(i, stops[0].color.r, stops[0].color.g, stops[0].color.b);
      continue;
    }
    let s = 0;
    while (s < stops.length - 2 && y > stops[s + 1].y) s++;
    const lo = stops[s];
    const hi = stops[s + 1];
    const raw = (y - lo.y) / (hi.y - lo.y);
    const t = raw * raw * (3 - 2 * raw); // smoothstep, so the bands don't band
    tmp.copy(lo.color).lerp(hi.color, t);
    colorAttribute.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }

  colorAttribute.needsUpdate = true;
}

/**
 * Blends the existing per-vertex terrain color toward a wet-zone or dry-zone tint,
 * per vertex, using src/utils/climateZone3d.ts's reconstruction of Sri Lanka's real
 * wet/dry boundary.
 *
 * The island read as one flat ochre plateau, which is the single most wrong thing
 * about it: the real contrast between the green southwest quarter and the dry
 * brown north and east is the island's most recognisable feature. This adds that
 * as a second dimension on top of addRadialGradient's centre-to-edge gradient
 * (rather than replacing it), and costs nothing at all to render — it only
 * rewrites an attribute that was already there, so no extra geometry, no extra
 * material, no extra draw call.
 *
 * Both this and the vegetation scatter read the same getWetness, so the forest
 * always lands on the green ground and the scrub on the brown.
 *
 * `strength` caps how far the tint can pull: the terrain is a backdrop for
 * markers and route lines, so full-saturation green would fight them.
 */
export function applyZoneTint(
  geometry: THREE.ExtrudeGeometry,
  wetColor: THREE.Color,
  dryColor: THREE.Color,
  strength: number,
  tier = -1,
): void {
  const position = geometry.attributes.position;
  const colorAttribute = geometry.attributes.color as THREE.BufferAttribute | undefined;
  if (!colorAttribute) return;

  const base = new THREE.Color();
  const target = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const wetness = getWetness(position.getX(i), position.getZ(i), tier);
    base.fromBufferAttribute(colorAttribute, i);
    target.copy(dryColor).lerp(wetColor, wetness);
    base.lerp(target, strength);
    colorAttribute.setXYZ(i, base.r, base.g, base.b);
  }

  colorAttribute.needsUpdate = true;
}

/** Sun-bleached on top, damp at the waterline, and darker still on the part that's under the lagoon. */
const SAND_STOPS = [
  { y: ISLAND_BOTTOM_Y, color: SHOAL },
  { y: WATER_CREST_Y, color: WET_SAND },
  { y: ISLAND_BEACH_Y, color: DRY_SAND },
] as const;

function paintSand(geometry: THREE.ExtrudeGeometry, frame?: GradientFrame): void {
  // A touch of radial variation so the sand isn't dead flat, then the wet/dry
  // ramp over everything below the shelf's top surface.
  addRadialGradient(geometry, DRY_SAND, DRY_SAND_EDGE, frame);
  addVerticalGradient(geometry, SAND_STOPS);
}

/** One extruded mesh: material-0 is the top/bottom cap (three.js's own group order), material-1 the cut side walls. */
function IslandPiece({ geometry, sideColor }: { geometry: THREE.ExtrudeGeometry; sideColor: string }) {
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial attach="material-0" vertexColors roughness={0.9} flatShading />
      <meshStandardMaterial attach="material-1" color={sideColor} roughness={0.95} flatShading />
    </mesh>
  );
}

/** The beach's side wall carries the wet/dry gradient, so unlike every other piece it can't take a flat side color. */
function SandPiece({ geometry }: { geometry: THREE.ExtrudeGeometry }) {
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial attach="material-0" vertexColors roughness={0.85} flatShading />
      <meshStandardMaterial attach="material-1" vertexColors roughness={0.9} flatShading />
    </mesh>
  );
}

export function Island() {
  const { beach, lowlands, islets } = useMemo(() => {
    const beachGeometry = buildExtrusion(
      ISLAND_MAIN_RING,
      BEACH_EXTRUDE_SETTINGS,
      ISLAND_BEACH_Y - (BEACH_EXTRUDE_SETTINGS.depth + BEACH_EXTRUDE_SETTINGS.bevelThickness),
    );

    // Every piece of the island shares the main slab's gradient frame so the
    // small ones don't each get their own full centre-to-edge sweep.
    beachGeometry.computeBoundingSphere();
    const sphere = beachGeometry.boundingSphere;
    const frame: GradientFrame = {
      center: sphere?.center.clone() ?? new THREE.Vector3(),
      radius: sphere && sphere.radius > 0 ? sphere.radius : 1,
    };

    paintSand(beachGeometry, frame);

    const lowlandGeometries = ISLAND_INLAND_RINGS.map((ring) => {
      const geometry = buildExtrusion(ring, LOWLAND_EXTRUDE_SETTINGS, ISLAND_BEACH_Y);
      addRadialGradient(geometry, LOWLAND_CENTER_COLOR, LOWLAND_EDGE_COLOR, frame);
      applyZoneTint(geometry, LOWLAND_WET, LOWLAND_DRY, LOWLAND_ZONE_STRENGTH);
      return geometry;
    });

    const isletGeometries = ISLAND_ISLET_RINGS.map((ring) => {
      const geometry = buildExtrusion(ring, ISLET_EXTRUDE_SETTINGS, ISLAND_BOTTOM_Y);
      // No radial frame: they're sand bars a fraction of a unit across, and
      // they're all in the dry north anyway, so a climate gradient over one
      // would be a single flat shift.
      paintSand(geometry, frame);
      return geometry;
    });

    return { beach: beachGeometry, lowlands: lowlandGeometries, islets: isletGeometries };
  }, []);

  return (
    <group>
      <SandPiece geometry={beach} />
      {lowlands.map((geometry, i) => (
        <IslandPiece key={`lowland-${i}`} geometry={geometry} sideColor={LOWLAND_SIDE_COLOR} />
      ))}
      {islets.map((geometry, i) => (
        <SandPiece key={`islet-${i}`} geometry={geometry} />
      ))}
    </group>
  );
}
