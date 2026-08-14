import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeParts } from "../../utils/mergeParts";
import { MAHAWELI_POINTS, MAHAWELI_WIDTH, WATER_BODIES, type WaterBody } from "../../data/inlandWater";
import { createRandom } from "../../utils/scatter3d";
import { getTerrainSurfaceY } from "./Highlands";
import "./StillWater";
import type { StillWaterMaterialInstance } from "./StillWater";

/**
 * The island's lakes, tanks and river. Two meshes total: every still body merged
 * into one geometry, and the Mahaweli as a second (it needs its own material
 * instance, since it's the only one that flows).
 *
 * Both sit a hair above the terrain rather than exactly on it, the same trick
 * RouteLine3D uses with ROUTE_LIFT: coplanar surfaces z-fight, and the scene's
 * deliberately tight near/far range (see the Canvas comment in TripMap3D) makes
 * that worse on mobile's lower-precision depth buffers, not better.
 */

/** Enough to clear the terrain reliably, small enough that the water never reads as hovering. */
const WATER_LIFT = 0.006;

/**
 * Points around a lake's outline. Raised from 14 after the first render: at 14
 * with heavy jitter the lakes read as ragged splats rather than water, and the
 * "cut paper" faceting that suits a whole island's coastline is too coarse a
 * gesture for something a fiftieth of its size.
 */
const RING_SEGMENTS = 22;
/**
 * How far each outline point wanders in or out, as a fraction of the radius. Much
 * gentler than the original 0.3, which is what made them look torn: enough to
 * break the circle, not enough to make a star.
 */
const RING_JITTER = 0.11;
/**
 * How far past the waterline the damp-bank margin extends, as a fraction of the
 * radius. Wide enough to be a gradient into the terrain rather than a visible
 * ring around the lake; see StillWater's UV convention.
 */
const BANK_WIDTH = 0.32;

/**
 * Lowest terrain height anywhere under a footprint.
 *
 * A lake is one flat polygon, so it needs one height — and the *lowest* one is
 * the right choice: water fills the low ground. Where a terrace steps up inside
 * the footprint, that terrace is then higher than the water plane and simply
 * occludes it, which reads as the lake stopping at the bank. Taking the height at
 * the centre instead would leave the water floating over the low side and buried
 * under the high side.
 */
function lowestSurfaceY(body: WaterBody): number {
  let min = Infinity;
  for (let a = 0; a < RING_SEGMENTS; a++) {
    const angle = (a / RING_SEGMENTS) * Math.PI * 2;
    for (const f of [0, 0.55, 1]) {
      const y = getTerrainSurfaceY(body.x + Math.cos(angle) * body.radius * f, body.z + Math.sin(angle) * body.radius * f);
      if (y < min) min = y;
    }
  }
  return min;
}

/**
 * One lake: a centre vertex, a jittered waterline ring, and a bank ring just
 * outside it. UVs follow StillWater's convention — u is 1 at the centre, 0 at the
 * waterline and negative on the bank, v runs around the rim — so the shader gets
 * both depth and shoreline for free.
 *
 * The outline is smoothed rather than used raw: each waterline radius is averaged
 * with its neighbours, which turns the random walk into something that reads as an
 * organic bay-and-headland shape instead of noise.
 */
function buildBodyGeometry(body: WaterBody): THREE.BufferGeometry {
  const y = lowestSurfaceY(body) + WATER_LIFT;
  const random = createRandom(body.seed);

  const raw = Array.from({ length: RING_SEGMENTS }, () => 1 - RING_JITTER * 0.5 + random() * RING_JITTER);
  const radii = raw.map((_, i) => {
    const prev = raw[(i - 1 + RING_SEGMENTS) % RING_SEGMENTS];
    const next = raw[(i + 1) % RING_SEGMENTS];
    return ((prev + raw[i] * 2 + next) / 4) * body.radius;
  });

  // Vertex 0 is the centre; then the waterline ring; then the bank ring.
  const positions: number[] = [body.x, y, body.z];
  const uvs: number[] = [1, 0.5];
  for (const scale of [1, 1 + BANK_WIDTH]) {
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const angle = (i / RING_SEGMENTS) * Math.PI * 2;
      const r = radii[i] * scale;
      positions.push(body.x + Math.cos(angle) * r, y, body.z + Math.sin(angle) * r);
      uvs.push(scale === 1 ? 0 : -1, i / RING_SEGMENTS);
    }
  }

  const waterRing = 1;
  const bankRing = 1 + RING_SEGMENTS;
  const indices: number[] = [];
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const next = (i + 1) % RING_SEGMENTS;
    // Wound so faces point up (+Y) under the winding order three expects.
    indices.push(0, waterRing + next, waterRing + i);
    indices.push(waterRing + i, waterRing + next, bankRing + i);
    indices.push(bankRing + i, waterRing + next, bankRing + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** How many points to sample along the river spline. Enough that each terrain terrace it crosses gets its own step. */
const RIVER_SAMPLES = 80;
/** Vertices per cross-section: bank, waterline, centre, waterline, bank. */
const RIVER_COLUMNS = 5;
/** Damp-bank margin either side of the river, as a fraction of its half-width. */
const RIVER_BANK_WIDTH = 0.9;

/**
 * The Mahaweli as a flat ribbon that follows the terrain down.
 *
 * Built by hand rather than with TubeGeometry (which RouteLine3D uses for route
 * lines): a tube is a closed pipe, and a river is a strip lying on the ground.
 * Each sample's height comes from getTerrainSurfaceY, so the ribbon steps down
 * terrace by terrace exactly like the real river descends the hill country.
 * Width tapers from headwater to mouth.
 */
function buildRiverGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    MAHAWELI_POINTS.map((p) => new THREE.Vector3(p.x, 0, p.z)),
    false,
    "catmullrom",
    0.4,
  );

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  for (let i = 0; i <= RIVER_SAMPLES; i++) {
    const t = i / RIVER_SAMPLES;
    curve.getPointAt(t, point);
    curve.getTangentAt(t, tangent);
    // Perpendicular in the XZ plane; the curve is authored flat, so the tangent's
    // Y component is zero and this is a plain 2D rotation.
    const nx = -tangent.z;
    const nz = tangent.x;
    const halfWidth = THREE.MathUtils.lerp(MAHAWELI_WIDTH.start, MAHAWELI_WIDTH.end, t);

    // Five columns across: damp bank, waterline, centreline, waterline, damp bank.
    // The centre column is what lets u encode distance from the bank (0 at both
    // banks, 1 down the middle) rather than ramping from one side to the other,
    // and the outer two give the river the same shoreline the lakes get, so it
    // doesn't read as a painted blue stripe.
    for (const [offset, u] of [
      [-halfWidth * (1 + RIVER_BANK_WIDTH), -1],
      [-halfWidth, 0],
      [0, 1],
      [halfWidth, 0],
      [halfWidth * (1 + RIVER_BANK_WIDTH), -1],
    ] as const) {
      const x = point.x + nx * offset;
      const z = point.z + nz * offset;
      positions.push(x, getTerrainSurfaceY(x, z) + WATER_LIFT, z);
      uvs.push(u, t);
    }

    if (i > 0) {
      const prev = (i - 1) * RIVER_COLUMNS;
      const cur = i * RIVER_COLUMNS;
      for (let c = 0; c < RIVER_COLUMNS - 1; c++) {
        indices.push(prev + c, prev + c + 1, cur + c, cur + c, prev + c + 1, cur + c + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Scrolling speed of the river's surface pattern. Slow: a broad lowland river, not a torrent. */
const RIVER_FLOW = 0.035;

export function InlandWater({ nightRef }: { nightRef: RefObject<number> }) {
  const lakeMaterialRef = useRef<StillWaterMaterialInstance>(null);
  const riverMaterialRef = useRef<StillWaterMaterialInstance>(null);

  const lakeGeometry = useMemo(() => mergeParts(WATER_BODIES.map(buildBodyGeometry), "inland water"), []);

  const riverGeometry = useMemo(buildRiverGeometry, []);

  useFrame((_state, delta) => {
    for (const ref of [lakeMaterialRef, riverMaterialRef]) {
      const material = ref.current;
      if (!material) continue;
      material.uTime += delta;
      material.uNight = nightRef.current;
    }
  });

  return (
    <group>
      {/* precision="highp" for the same reason Water.tsx forces it: most mobile
          GPUs default fragment shaders to mediump, where the sin() terms lose
          enough precision as uTime grows to visibly dither. */}
      {/* transparent, because the damp-bank margin fades out at its outer edge so
          it blends into whatever terrain colour is underneath rather than ending in
          a hard ring. depthWrite stays on: these are flat, horizontal and almost
          entirely opaque, so there's nothing for them to sort incorrectly against. */}
      <mesh geometry={lakeGeometry}>
        <stillWaterMaterial ref={lakeMaterialRef} precision="highp" transparent uRippleScale={1} />
      </mesh>
      <mesh geometry={riverGeometry}>
        <stillWaterMaterial
          ref={riverMaterialRef}
          precision="highp"
          transparent
          uFlow={RIVER_FLOW}
          uRippleScale={0.4}
        />
      </mesh>
    </group>
  );
}
