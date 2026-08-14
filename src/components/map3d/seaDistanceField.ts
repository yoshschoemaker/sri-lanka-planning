import * as THREE from "three";
import {
  ISLAND_INLAND_RINGS,
  ISLAND_ISLET_RINGS,
  ISLAND_MAIN_RING,
  MAX_BEACH_WIDTH,
} from "../../data/srilankaShape3d";
import { createRingDistanceField, ringBounds, type Ring } from "../../utils/geometry3d";

/**
 * Bakes "how far offshore am I, which way is the open sea, and how wide is the
 * shelf here" into one texture, so the sea shader can shade against the real
 * coastline instead of against distance from the world origin.
 *
 * The old shader keyed its depth gradient, its sparkle falloff and its foam
 * band on `length(vPos)` — concentric circles centred on (0, 0). The island is
 * 4.9 wide and 8.7 long, so the "foam line where the lagoon meets the island's
 * bevel" ran *inland* of the coast along the north-south axis and sat in open
 * water along the east-west one. No amount of tuning fixes a circle drawn
 * around a non-circular island; it needs the actual distance to the shore.
 *
 * ## Why the bake works this way
 *
 * The obvious implementation, calling geometry3d's distanceToRing once per
 * texel, costs about a second: 145k texels against 291 coastline segments.
 * createRingDistanceField's bucket grid does not rescue it either, because that
 * grid uses one cell per cutoff, and at the ~2.4-unit reach this field needs a
 * single cell holds most of the coastline anyway.
 *
 * So the exact walk runs only where the bucket grid genuinely accelerates it —
 * within SEED_CUTOFF of the shore — and two 8SSEDT sweeps propagate outward
 * from those seeds. The sweep carries the *vector* to the nearest coast point
 * rather than just its length, which is what makes the offshore direction the
 * waves refract against fall out of the same pass for free.
 *
 * Accuracy is exact where it is looked at closely and approximate only where
 * everything has saturated: 0 error inside 0.3 units (the whole foam and
 * shallows band), a few thousandths out to 0.8, a few hundredths beyond.
 */

/**
 * How far offshore the field reaches before ClampToEdgeWrapping takes over.
 * Every term in the shader saturates by ~1.6, so clamping past this is not an
 * approximation: the edge texel already holds a distance larger than anything
 * the shader can still distinguish.
 */
const FIELD_MARGIN = 2.4;

/**
 * Radius within which distances are seeded exactly. Large enough that the foam
 * band, the shallows and the refraction ramp are all error-free; small enough
 * that the bucket grid still narrows each query to a handful of segments.
 */
const SEED_CUTOFF = 0.5;

/**
 * Mirrors `bevelSize` in Island.tsx's BEACH_EXTRUDE_SETTINGS, which is not
 * exported. Kept as its own constant here rather than threaded through because
 * the two describe different things that happen to share a number: there it is
 * how far the bevel steps in, here it is how far the visible waterline sits
 * outside the ring the slab was extruded from.
 *
 * ExtrudeGeometry's bevel expands the body *outward* — verified by building the
 * real geometry and reading its bounding box, not assumed: a shape spanning
 * x 0..2 comes out spanning -0.05..2.05. So the silhouette the camera sees at
 * the waterline is the coastline ring offset outward by this much, and foam
 * keyed to the raw ring would sit that far inland of the water's actual edge.
 *
 * Taken at mean sea level, where the waterline actually sits. The offset does
 * taper back to zero across the slab's top and bottom bevel bands, so at the
 * very crest of a swell the true edge is ~0.03 further in — comfortably inside
 * the foam band's own 0.16-unit width, and not worth a per-height correction.
 */
const BEACH_BEVEL_SIZE = 0.05;

/** World units per texel. Desktop resolves the foam edge; mobile trades a third of the sharpness for a quarter of the bake and memory. */
export const SEA_FIELD_TEXEL = { high: 0.03, low: 0.05 } as const;

export interface SeaShoreSample {
  /** Signed distance to the visible waterline: positive offshore, negative over land. */
  distance: number;
  /** Unit vector pointing away from the nearest shore, toward open sea. */
  dirX: number;
  dirZ: number;
  /** Local beach width normalised to [0, 1] against MAX_BEACH_WIDTH — a stand-in for how steeply the seabed drops away. */
  shelf: number;
}

export interface SeaShoreField {
  texture: THREE.DataTexture;
  /** Feeds the uShoreWindow uniform: xy = window origin in world (x, z), zw = 1 / window size. */
  window: THREE.Vector4;
  /** CPU read-back of the same field, so seaGeometry can bake it per vertex instead of the vertex stage needing a texture fetch. */
  sample: (x: number, z: number) => SeaShoreSample;
  dispose: () => void;
}

/** Vector from the segment's nearest point to the query point, i.e. pointing away from the segment. */
function vectorFromSegment(
  x: number,
  z: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): [number, number] {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return [x - x1, z - z1];
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / lengthSq));
  return [x - (x1 + t * dx), z - (z1 + t * dz)];
}

interface FieldRing {
  ring: Ring;
  /** How far outward this ring's visible edge sits from the ring itself. */
  offset: number;
  /** Fixed shelf value, for rings with no inland counterpart to measure a beach width against. */
  shelf: number | null;
}

export function buildSeaShoreField(texel: number): SeaShoreField {
  // The islets are extruded without a bevel, so their visible edge is the ring
  // itself. They also have no inland ring to derive a beach width from, so they
  // get a fixed gently-shelving value — they are sand bars, all shallows.
  const rings: FieldRing[] = [
    { ring: ISLAND_MAIN_RING, offset: BEACH_BEVEL_SIZE, shelf: null },
    ...ISLAND_ISLET_RINGS.map((ring) => ({ ring, offset: 0, shelf: 0.35 })),
  ];

  const segments: { x1: number; z1: number; x2: number; z2: number; ring: number }[] = [];
  rings.forEach(({ ring }, index) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      segments.push({ x1: ring[j][0], z1: ring[j][1], x2: ring[i][0], z2: ring[i][1], ring: index });
    }
  });

  const bounds = ringBounds(ISLAND_MAIN_RING);
  const minX = bounds.minX - FIELD_MARGIN;
  const minZ = bounds.minZ - FIELD_MARGIN;
  const sizeX = bounds.maxX - bounds.minX + FIELD_MARGIN * 2;
  const sizeZ = bounds.maxZ - bounds.minZ + FIELD_MARGIN * 2;
  const width = Math.ceil(sizeX / texel);
  const height = Math.ceil(sizeZ / texel);
  const count = width * height;

  // --- 1. inside/outside, by scanline ---------------------------------------
  // Filling spans between sorted edge crossings costs one pass over the
  // segments per texel *row*. Calling pointInRing per texel would be the same
  // work per texel, which is two orders of magnitude more.
  const onLand = new Uint8Array(count);
  const crossings: number[] = [];
  for (let j = 0; j < height; j++) {
    const z = minZ + (j + 0.5) * texel;
    crossings.length = 0;
    for (const s of segments) {
      if (s.z1 > z !== s.z2 > z) crossings.push(s.x1 + ((z - s.z1) / (s.z2 - s.z1)) * (s.x2 - s.x1));
    }
    crossings.sort((a, b) => a - b);
    for (let c = 0; c + 1 < crossings.length; c += 2) {
      const from = Math.max(0, Math.ceil((crossings[c] - minX) / texel - 0.5));
      const to = Math.min(width - 1, Math.floor((crossings[c + 1] - minX) / texel - 0.5));
      for (let i = from; i <= to; i++) onLand[j * width + i] = 1;
    }
  }

  // --- 2. exact seeds near the shore ----------------------------------------
  const cell = SEED_CUTOFF;
  const buckets = new Map<number, number[]>();
  const bucketKey = (cx: number, cz: number) => (cx + 512) * 4096 + (cz + 512);
  segments.forEach((s, index) => {
    const fromX = Math.floor((Math.min(s.x1, s.x2) - SEED_CUTOFF) / cell);
    const toX = Math.floor((Math.max(s.x1, s.x2) + SEED_CUTOFF) / cell);
    const fromZ = Math.floor((Math.min(s.z1, s.z2) - SEED_CUTOFF) / cell);
    const toZ = Math.floor((Math.max(s.z1, s.z2) + SEED_CUTOFF) / cell);
    for (let cx = fromX; cx <= toX; cx++) {
      for (let cz = fromZ; cz <= toZ; cz++) {
        const key = bucketKey(cx, cz);
        const bucket = buckets.get(key);
        if (bucket) bucket.push(index);
        else buckets.set(key, [index]);
      }
    }
  });

  /**
   * Local beach width doubles as the bathymetry cue, which is free geography
   * rather than a second hand-authored map: scripts/build-map.mjs erodes the
   * coastline by a per-coast beach width to get ISLAND_INLAND_RINGS, so a wide
   * beach marks a gently shelving foreshore (Palk Bay, the northwest) and a
   * narrow one a steep drop (the south coast).
   */
  const beachWidthAt = createRingDistanceField(ISLAND_INLAND_RINGS, MAX_BEACH_WIDTH + 0.02);

  const FAR = 1e9;
  // Vector from the nearest coast point to this texel, so it already points
  // offshore for sea texels (and inland for land ones, corrected on pack).
  const vx = new Float32Array(count).fill(FAR);
  const vz = new Float32Array(count).fill(FAR);
  // Carried along by the sweep so an offshore texel inherits the edge offset
  // and shelf width of whichever stretch of coast it actually faces.
  const offset = new Float32Array(count);
  const shelf = new Float32Array(count);

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const x = minX + (i + 0.5) * texel;
      const z = minZ + (j + 0.5) * texel;
      const candidates = buckets.get(bucketKey(Math.floor(x / cell), Math.floor(z / cell)));
      if (!candidates) continue;
      let best = SEED_CUTOFF * SEED_CUTOFF;
      let bestX = 0;
      let bestZ = 0;
      let bestSegment = -1;
      for (const index of candidates) {
        const s = segments[index];
        const [dx, dz] = vectorFromSegment(x, z, s.x1, s.z1, s.x2, s.z2);
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq < best) {
          best = distanceSq;
          bestX = dx;
          bestZ = dz;
          bestSegment = index;
        }
      }
      if (bestSegment < 0) continue;
      const p = j * width + i;
      vx[p] = bestX;
      vz[p] = bestZ;
      const ring = rings[segments[bestSegment].ring];
      offset[p] = ring.offset;
      // Measured at the coast point rather than at the texel, so a point two
      // units out to sea still gets the shelf of the beach it is facing.
      shelf[p] = ring.shelf ?? Math.min(beachWidthAt(x - bestX, z - bestZ) / MAX_BEACH_WIDTH, 1);
    }
  }

  // --- 3. two 8SSEDT sweeps -------------------------------------------------
  // vx/vz hold (texel - seed), so borrowing q's seed for p means adding
  // (p - q)'s own displacement to q's vector.
  const consider = (p: number, q: number, ox: number, oz: number) => {
    const ax = vx[q] + ox;
    const az = vz[q] + oz;
    if (ax * ax + az * az < vx[p] * vx[p] + vz[p] * vz[p]) {
      vx[p] = ax;
      vz[p] = az;
      offset[p] = offset[q];
      shelf[p] = shelf[q];
    }
  };

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const p = j * width + i;
      if (i > 0) consider(p, p - 1, texel, 0);
      if (j > 0) consider(p, p - width, 0, texel);
      if (i > 0 && j > 0) consider(p, p - width - 1, texel, texel);
      if (i < width - 1 && j > 0) consider(p, p - width + 1, -texel, texel);
      // A second look leftward, now that the row above has been folded in.
      if (i > 0) consider(p, p - 1, texel, 0);
    }
  }
  for (let j = height - 1; j >= 0; j--) {
    for (let i = width - 1; i >= 0; i--) {
      const p = j * width + i;
      if (i < width - 1) consider(p, p + 1, -texel, 0);
      if (j < height - 1) consider(p, p + width, 0, -texel);
      if (i < width - 1 && j < height - 1) consider(p, p + width + 1, -texel, -texel);
      if (i > 0 && j < height - 1) consider(p, p + width - 1, texel, -texel);
      if (i < width - 1) consider(p, p + 1, -texel, 0);
    }
  }

  const signedAt = (p: number, raw: number) => (onLand[p] ? -raw : raw) - offset[p];
  // Flip the stored vector on land so the direction points offshore everywhere.
  const inverseAt = (p: number, raw: number) => (raw > 1e-5 ? (onLand[p] ? -1 / raw : 1 / raw) : 0);

  // --- 4. pack --------------------------------------------------------------
  // RGBA16F rather than 8-bit. The foam band is 0.16 world units wide, and
  // quantising a [-1, 3] range to 8 bits gives 0.0156 per step — half a texel,
  // which visibly stair-steps the foam edge exactly where the eye is drawn.
  // Half float is linearly filterable in core WebGL2, and three has been
  // WebGL2-only since r163, so there is no fallback path to maintain.
  const data = new Uint16Array(count * 4);
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let p = 0; p < count; p++) {
    // sqrt, not Math.hypot: hypot guards against intermediate overflow, which
    // these two sub-unit offsets cannot produce, and it costs roughly an order
    // of magnitude more per call. Over the whole grid that is most of the pack.
    const raw = Math.sqrt(vx[p] * vx[p] + vz[p] * vz[p]);
    const inverse = inverseAt(p, raw);
    data[p * 4] = toHalf(signedAt(p, raw));
    data[p * 4 + 1] = toHalf(vx[p] * inverse);
    data[p * 4 + 2] = toHalf(vz[p] * inverse);
    data[p * 4 + 3] = toHalf(shelf[p]);
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Data, not colour. Leaving colorSpace at its NoColorSpace default keeps
  // three from applying an sRGB decode to distances.
  texture.needsUpdate = true;

  /**
   * Nearest-texel, not bilinear, so it carries up to half a texel diagonal of
   * quantisation — measured at 0.020 world units at the high-detail texel.
   * Deliberate: its only consumer is seaGeometry's per-vertex bake, and the two
   * things the vertex stage does with the value (the steepness envelope over
   * 0.30 units, the refraction ramp over 1.30) are far smoother than that. The
   * fragment stage reads the texture through LinearFilter and is unaffected.
   */
  const sample = (x: number, z: number): SeaShoreSample => {
    const i = Math.min(width - 1, Math.max(0, Math.round((x - minX) / texel - 0.5)));
    const j = Math.min(height - 1, Math.max(0, Math.round((z - minZ) / texel - 0.5)));
    const p = j * width + i;
    const raw = Math.sqrt(vx[p] * vx[p] + vz[p] * vz[p]);
    const inverse = inverseAt(p, raw);
    return {
      distance: signedAt(p, raw),
      dirX: vx[p] * inverse,
      dirZ: vz[p] * inverse,
      shelf: shelf[p],
    };
  };

  return {
    texture,
    window: new THREE.Vector4(minX, minZ, 1 / sizeX, 1 / sizeZ),
    sample,
    dispose: () => texture.dispose(),
  };
}
