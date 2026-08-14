import { useMemo } from "react";
import * as THREE from "three";
import { mergeParts } from "../../utils/mergeParts";
import { getTerrainSurfaceY } from "./Highlands";

// Deliberately warm rust/red rather than anything in the terrain's own
// olive-brown "cut side wall" family (e.g. Highlands.tsx's #6e5c34) — an
// earlier attempt at a muted brown very nearly matched that color and the
// rock all but disappeared against the hillside behind it.
const ROCK_COLOR = "#a8492e";
const SUMMIT_COLOR = "#c46340";
const SCREE_COLOR = "#8a6248";
const RUIN_COLOR = "#e8dcb8";
const STAIR_COLOR = "#6d6259";
const GARDEN_COLOR = "#6f8f4a";

/**
 * Sigiriya's Lion Rock: a real, named landmark (not a generic decoration like
 * PalmTree/WaveCrest), so it gets its own monolith rather than a hand-wavy
 * bump — the real rock is a ~200m volcanic plug rising abruptly out of flat
 * plains, and that abruptness is the whole silhouette.
 *
 * Two earlier versions record what that silhouette is *not*. Stacking
 * separately rotated boxes for the strata read as a pile of crates: once a
 * shape this recognisable is broken into blocks, the eye counts the blocks.
 * Replacing them with one tapered cylinder plus two thin ledge rings read as a
 * barrel with belts, for the same reason in miniature — anything that circles
 * the rock at a constant height bands it.
 *
 * So the mass is one continuous hull with no horizontal seam anywhere: rings
 * of vertices lofted between a height PROFILE and a PLAN of per-side radii,
 * each vertex nudged by a fixed wobble. The plan is deliberately lopsided
 * (0.82 to 1.08 of the radius), which is what makes it a rock rather than a
 * prism, and the one step in the profile is a diagonal shelf rather than a
 * ring. The overhang near the top is real: the summit of Sigiriya genuinely
 * juts out past its own base.
 *
 * The named details are what make it Sigiriya rather than a red hill: the flat
 * summit plateau with the palace foundations and its patch of garden green,
 * the lion's-paw terrace on the north face, and the stairway switchbacking
 * from that terrace to the top.
 */

/** Few enough faces that each one catches the light separately, like the island's own laser-cut edges. */
const SIDES = 11;
/**
 * Proportions matter more here than any surface detail. The first pass at this
 * hull was twice as tall as it was wide and read as a tree stump; the real rock
 * is only about as tall as its base is broad, and it looks vertiginous because
 * the plain around it is flat, not because it is narrow.
 */
const ROCK_HEIGHT = 0.33;
const BASE_RADIUS = 0.112;
/** The plan is an oval, not a circle. Applied to every piece, so they all stay flush. */
const PLAN_SQUASH = 0.78;

/**
 * Per-side radius multipliers. Hand-picked rather than generated: a couple of
 * broad flanks, one pinched side and one bulge is what the real plug looks
 * like from above, and a random set tends to average out into a circle.
 */
const PLAN = [1.06, 0.92, 1.0, 0.84, 0.95, 1.08, 0.98, 0.86, 1.03, 0.9, 1.0];

/**
 * [height fraction, radius multiplier]. Near-vertical for most of the climb
 * (that is what makes the face unclimbable), one shelf where the strata step
 * out, and a top that flares back out before the summit cuts it flat.
 */
const PROFILE: [number, number][] = [
  [0, 1.0],
  [0.1, 1.02],
  [0.33, 0.97],
  [0.46, 0.955],
  [0.52, 0.9],
  [0.72, 0.895],
  [0.86, 0.93],
  // Rounds the summit shoulder off over two rings. A single step from the face
  // straight to the cap gives the rock a lid, like a tin.
  [0.94, 0.92],
  [0.98, 0.86],
  [1, 0.78],
];

/** How far each vertex is pushed off its ring, as a fraction of the radius. */
const CRAG = 0.055;
/** The whole mass leans as it rises, so the two vertical outlines are not mirror images. */
const LEAN_X = 0.014;
const LEAN_Z = -0.01;
/** Height of the lion's-paw terrace, as a fraction of the rock. */
const TERRACE_T = 0.5;
/** Which face the paws and the stairway sit on, as a side index. */
const NORTH_SIDE = 2;

/** Radius multiplier from the profile at any height, linearly between its control points. */
function profileAt(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 1; i < PROFILE.length; i++) {
    const [t1, r1] = PROFILE[i];
    if (clamped <= t1) {
      const [t0, r0] = PROFILE[i - 1];
      return r0 + ((r1 - r0) * (clamped - t0)) / (t1 - t0);
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

/** Radius multiplier from the plan at any (possibly fractional) side. */
function planAt(side: number): number {
  const f = ((side % SIDES) + SIDES) % SIDES;
  const i = Math.floor(f);
  return PLAN[i] + (PLAN[(i + 1) % SIDES] - PLAN[i]) * (f - i);
}

/**
 * A point on the rock face, and the single source of truth for where that face
 * is: the hull's own vertices come from here, and so does every step, ledge and
 * paw hung off it. Two versions ago those were two different formulas and the
 * staircase visibly floated beside the rock.
 *
 * `side` runs 0..SIDES around the rock and `t` 0..1 up it; `out` pushes a prop
 * clear of (or into) the face.
 */
function surfacePoint(t: number, side: number, out = 0) {
  const theta = ((side + t * 0.35) / SIDES) * Math.PI * 2;
  // Each side samples the profile at a slightly different height, which turns
  // the one shelf in it into a diagonal that wanders around the rock instead of
  // a horizontal band. Any feature at a constant height reads as a belt.
  const shelfPhase = 0.055 * Math.sin(side * 1.7 + 0.4);
  const crag = 1 + CRAG * (Math.sin(side * 2.3 + t * 5.1) * 0.6 + Math.sin(side * 1.1 - t * 8.7) * 0.4);
  // Grows with height, so the summit outline is ragged rather than a tidy
  // polygon rim. A regular top edge is what made an earlier hull read as a lid.
  const jag = 1 + 0.07 * Math.sin(side * 2.9 + 1.1) * t * t;
  const radius = BASE_RADIUS * planAt(side) * profileAt(t + shelfPhase) * crag * jag + out;
  return {
    x: Math.cos(theta) * radius + LEAN_X * t * t,
    y: t * ROCK_HEIGHT,
    z: Math.sin(theta) * radius * PLAN_SQUASH + LEAN_Z * t * t,
    /** Yaw that turns a box's width along the tangent, so props lie flat against the face. */
    yaw: -(theta + Math.PI / 2),
  };
}

/**
 * A tint per triangle, multiplied into the rock colour. This is the closest
 * thing to a texture the diorama's flat-shaded look allows: the shading alone
 * gives one flat wash per face, and real gneiss is blotchy. Darkens towards the
 * base as well, which fakes the shadow the rock casts on itself down there.
 */
function faceTints(positions: number[]): number[] {
  const colors: number[] = [];

  for (let i = 0; i < positions.length; i += 9) {
    const centroidY = (positions[i + 1] + positions[i + 4] + positions[i + 7]) / 3;
    const centroidX = (positions[i] + positions[i + 3] + positions[i + 6]) / 3;
    const centroidZ = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;
    const blotch = Math.sin(centroidX * 61 + centroidY * 37) * Math.sin(centroidZ * 53 - centroidY * 29);
    const foot = Math.min(1, centroidY / (ROCK_HEIGHT * 0.45));
    const tint = 0.82 + 0.11 * blotch + 0.13 * foot;
    for (let v = 0; v < 3; v++) colors.push(tint, tint * 0.99, tint * 0.98);
  }

  return colors;
}

function buildMass() {
  const rings = PROFILE.map(([t]) =>
    Array.from({ length: SIDES }, (_, side) => {
      const p = surfacePoint(t, side);
      return new THREE.Vector3(p.x, p.y, p.z);
    }),
  );

  const sides: number[] = [];
  const push = (v: THREE.Vector3) => sides.push(v.x, v.y, v.z);

  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES;
      const lowI = rings[r][i];
      const lowJ = rings[r][j];
      const highI = rings[r + 1][i];
      const highJ = rings[r + 1][j];
      // Wound so the normals face outwards, which FrontSide culling needs.
      push(lowI);
      push(highI);
      push(lowJ);
      push(lowJ);
      push(highI);
      push(highJ);
    }
  }

  const body = new THREE.BufferGeometry();
  body.setAttribute("position", new THREE.Float32BufferAttribute(sides, 3));
  body.setAttribute("color", new THREE.Float32BufferAttribute(faceTints(sides), 3));
  body.computeVertexNormals();

  // Summit plateau as a fan over the top ring: flat, and its own colour, since
  // "you can stand up there" is the difference between this and a pointed hill.
  const top = rings[rings.length - 1];
  const cap: number[] = [];
  for (let i = 0; i < SIDES; i++) {
    const j = (i + 1) % SIDES;
    cap.push(LEAN_X, ROCK_HEIGHT, LEAN_Z);
    cap.push(top[j].x, top[j].y, top[j].z);
    cap.push(top[i].x, top[i].y, top[i].z);
  }
  const summit = new THREE.BufferGeometry();
  summit.setAttribute("position", new THREE.Float32BufferAttribute(cap, 3));
  summit.computeVertexNormals();

  return { body, summit };
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (ry) geometry.rotateY(ry);
  geometry.translate(x, y, z);
  return geometry;
}

function buildRock() {
  const { body, summit } = buildMass();

  // Scree skirt plus a few fallen blocks around the foot. The real plug sits in
  // its own rubble, and without it the rock looks pasted onto the terrain
  // rather than rising out of it — the blocks also break the outline where the
  // hull meets the ground, which is otherwise a clean extruded edge.
  const skirt = new THREE.ConeGeometry(BASE_RADIUS * 1.3, 0.045, SIDES);
  skirt.scale(1, 1, PLAN_SQUASH);
  skirt.translate(0, 0.008, 0);

  const blocks = [0.6, 3.4, 6.2, 8.9].map((side) => {
    const p = surfacePoint(0.02, side, 0.012);
    const lump = new THREE.IcosahedronGeometry(0.02 + 0.008 * Math.sin(side * 3.1), 0);
    lump.scale(1.1, 0.7, 0.9);
    lump.rotateY(side);
    lump.translate(p.x, 0.012, p.z);
    return lump;
  });

  const scree = mergeParts([skirt, ...blocks], "sigiriya scree");

  // The lion's paws: the terrace ledge plus the two forepaws that flank the
  // stairway between them, all that survives of the lion gate. Sunk a little
  // into the face (negative `out`) so the ledge grows out of the rock.
  const terrace = surfacePoint(TERRACE_T, NORTH_SIDE, -0.01);
  const paws = [-1, 1].map((s) => surfacePoint(TERRACE_T, NORTH_SIDE + s * 0.32, -0.006));
  const summitCentre = { x: LEAN_X, z: LEAN_Z };
  const ruins: THREE.BufferGeometry[] = [
    box(0.07, 0.01, 0.03, terrace.x, terrace.y, terrace.z, terrace.yaw),
    ...paws.map((p) => box(0.018, 0.018, 0.026, p.x, p.y + 0.013, p.z, p.yaw)),
    // Palace foundations on the summit: two low walls at right angles.
    box(0.048, 0.013, 0.007, summitCentre.x - 0.012, ROCK_HEIGHT + 0.006, summitCentre.z + 0.014, 0.5),
    box(0.007, 0.013, 0.038, summitCentre.x + 0.018, ROCK_HEIGHT + 0.006, summitCentre.z - 0.004, 0.5),
  ];

  // Stairway from the paw terrace to the summit. It sweeps less than half a
  // face's worth: swing it wider and the steps come round the curve and hang
  // off the silhouette in mid-air.
  const stairs: THREE.BufferGeometry[] = [];
  const STEPS = 12;
  for (let i = 0; i < STEPS; i++) {
    const k = i / (STEPS - 1);
    const t = TERRACE_T + (0.95 - TERRACE_T) * k;
    const side = NORTH_SIDE + Math.sin(k * Math.PI * 1.2) * 0.4 - 0.06;
    const p = surfacePoint(t, side, -0.001);
    stairs.push(box(0.022, 0.0035, 0.01, p.x, p.y, p.z, p.yaw));
  }

  // The summit water gardens, the one patch of green up there.
  const garden = box(0.04, 0.005, 0.028, summitCentre.x - 0.014, ROCK_HEIGHT + 0.003, summitCentre.z - 0.02, 0.5);

  return {
    scree,
    body,
    summit,
    ruins: mergeParts(ruins, "sigiriya ruins"),
    stairs: mergeParts(stairs, "sigiriya stairs"),
    garden,
  };
}

const GEOMETRY = buildRock();

const materials = {
  body: new THREE.MeshStandardMaterial({ color: ROCK_COLOR, roughness: 0.94, flatShading: true, vertexColors: true }),
  summit: new THREE.MeshStandardMaterial({ color: SUMMIT_COLOR, roughness: 0.9, flatShading: true }),
  scree: new THREE.MeshStandardMaterial({ color: SCREE_COLOR, roughness: 0.98, flatShading: true }),
  ruins: new THREE.MeshStandardMaterial({ color: RUIN_COLOR, roughness: 0.85, flatShading: true }),
  stairs: new THREE.MeshStandardMaterial({ color: STAIR_COLOR, roughness: 0.7, flatShading: true }),
  garden: new THREE.MeshStandardMaterial({ color: GARDEN_COLOR, roughness: 0.95, flatShading: true }),
};

export function SigiriyaRock({ x, z }: { x: number; z: number }) {
  const baseY = useMemo(() => getTerrainSurfaceY(x, z), [x, z]);

  return (
    <group position={[x, baseY, z]} rotation={[0, 0.35, 0]}>
      <mesh geometry={GEOMETRY.scree} material={materials.scree} />
      <mesh geometry={GEOMETRY.body} material={materials.body} />
      <mesh geometry={GEOMETRY.summit} material={materials.summit} />
      <mesh geometry={GEOMETRY.stairs} material={materials.stairs} />
      <mesh geometry={GEOMETRY.ruins} material={materials.ruins} />
      <mesh geometry={GEOMETRY.garden} material={materials.garden} />
    </group>
  );
}
