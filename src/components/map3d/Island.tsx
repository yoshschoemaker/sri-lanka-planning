import { useMemo } from "react";
import * as THREE from "three";
import { ISLAND_MAIN_RING, ISLAND_ISLET_RINGS } from "../../data/srilankaShape3d";
import { getWetness } from "../../utils/climateZone3d";

/**
 * Low-poly "paper diorama" extrusion: straight line segments only (no spline
 * smoothing keeps the laser-cut look), a shallow bevel for the cut edge, and
 * few bevel segments so the facets stay visible instead of reading as smooth.
 */
const MAIN_EXTRUDE_SETTINGS = {
  depth: 0.6,
  bevelEnabled: true,
  bevelThickness: 0.06,
  bevelSize: 0.05,
  bevelSegments: 2,
  steps: 1,
};

/**
 * World-space Y of the island's top surface after the extrude+rotate below
 * (verified against the actual geometry's bounding box, not just assumed):
 * the extrude's "back" cap (local z = depth + bevelThickness) becomes world Y
 * once rotated flat. Markers/routes (added in a later phase) anchor here so
 * they sit on the terrain instead of floating or clipping into it.
 */
export const ISLAND_TOP_Y = MAIN_EXTRUDE_SETTINGS.depth + MAIN_EXTRUDE_SETTINGS.bevelThickness;

// The four islets are tiny (well under 1 world unit across). Reusing the main
// island's bevel size/depth on something that small makes three.js's bevel
// contour math cross over itself (self-intersecting "spikes"), so islets get
// a flatter, unbevelled extrude scaled to their own footprint instead.
const ISLET_EXTRUDE_SETTINGS = {
  depth: 0.07,
  bevelEnabled: false,
  steps: 1,
};

const MAIN_RING_MIN_EXTENT_THRESHOLD = 1;

const TOP_CENTER_COLOR = new THREE.Color("#e7d5ac"); // sand
const TOP_EDGE_COLOR = new THREE.Color("#c2683f"); // terracotta
const SIDE_COLOR = "#9c5030"; // terracotta-dark, the "cut" faces

/** Lowland climate tints: a humid green for the wet southwest, the existing sandy ochre for the dry north and east. */
const LOWLAND_WET = new THREE.Color("#8fa863");
const LOWLAND_DRY = new THREE.Color("#d8bd8a");
/** Held well below 1: the terrain is a backdrop for markers and route lines, and a fully saturated green would fight them. */
const LOWLAND_ZONE_STRENGTH = 0.45;

type Ring = readonly (readonly [number, number])[];

function buildIslandGeometry(ring: Ring): THREE.ExtrudeGeometry {
  const xs = ring.map(([x]) => x);
  const zs = ring.map(([, z]) => z);
  const minExtent = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const settings = minExtent < MAIN_RING_MIN_EXTENT_THRESHOLD ? ISLET_EXTRUDE_SETTINGS : MAIN_EXTRUDE_SETTINGS;

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
  addRadialGradient(geometry);
  // Islets are a fraction of a world unit across, so a climate gradient over them
  // would be a single flat shift — and they're all in the dry north anyway.
  if (settings === MAIN_EXTRUDE_SETTINGS) {
    applyZoneTint(geometry, LOWLAND_WET, LOWLAND_DRY, LOWLAND_ZONE_STRENGTH);
  }
  return geometry;
}

/**
 * Fakes a radial center-to-edge color gradient across the top/bottom cap via
 * vertex colors, centered on the geometry's own bounding sphere. Shared with
 * Highlands.tsx's plateau layers (different palette, same technique) so the
 * hill-country "elevation bands" read as the same kind of surface as the
 * base island rather than a distinct material.
 */
export function addRadialGradient(
  geometry: THREE.ExtrudeGeometry,
  centerColor: THREE.Color = TOP_CENTER_COLOR,
  edgeColor: THREE.Color = TOP_EDGE_COLOR,
): void {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  const radius = sphere && sphere.radius > 0 ? sphere.radius : 1;
  const center = sphere?.center ?? new THREE.Vector3();

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

/** One extruded mesh: material-0 is the top/bottom cap (three.js's own group order), material-1 the cut side walls. */
function IslandPiece({ geometry }: { geometry: THREE.ExtrudeGeometry }) {
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial attach="material-0" vertexColors roughness={0.9} flatShading />
      <meshStandardMaterial attach="material-1" color={SIDE_COLOR} roughness={0.95} flatShading />
    </mesh>
  );
}

export function Island() {
  const mainGeometry = useMemo(() => buildIslandGeometry(ISLAND_MAIN_RING), []);
  const isletGeometries = useMemo(() => ISLAND_ISLET_RINGS.map(buildIslandGeometry), []);

  return (
    <group>
      <IslandPiece geometry={mainGeometry} />
      {isletGeometries.map((geometry, i) => (
        <IslandPiece key={i} geometry={geometry} />
      ))}
    </group>
  );
}
