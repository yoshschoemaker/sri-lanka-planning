import { useMemo, useRef } from "react";
import * as THREE from "three";
import { extend, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import type { TransportMode } from "../../types/trip";
import type { WorldPoint } from "../../utils/projection3d";
import { getTerrainSurfaceY } from "./Highlands";

/**
 * The route reads as a flat ribbon lying on the land, not as a tube.
 * A TubeGeometry gave every dash the look of a cut piece of sausage: shaded
 * top-to-bottom like a cylinder, with its open ends showing the hollow inside.
 * A ribbon with an up-facing normal is what a route on a map actually looks
 * like, and it lets the dash shape itself be drawn in the shader (rounded
 * pills) instead of being whatever a sliced cylinder happens to look like.
 */
const RIBBON_HALF_WIDTH = 0.026;
/** Exported so Train3D.tsx can rebuild the exact same curve for train-mode segments. */
export const ROUTE_LIFT = 0.025;
const RIBBON_SEGMENTS = 48;

/** Same stagger timing as TripMap.tsx's 2D route draw-on. */
const DRAW_DELAY_BASE = 0.2;
const DRAW_DELAY_STEP = 0.14;
const DRAW_DURATION = 0.9;

const DASH_WORLD_LENGTH = 0.16;
const DASH_RATIO = 0.5;

/** Matches TripMap.tsx's route-segment dim value exactly, for visual parity with the 2D fallback. */
const DIMMED_OPACITY = 0.25;
const OPACITY_LAMBDA = 10;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * One shader does all three jobs, gated on the ribbon's uv (x = 0..1 along the
 * route by arc length, y = 0..1 across its width):
 *  - draw-on reveal: discard fragments beyond uProgress.
 *  - tuktuk dash pattern: each dash is a capsule (rounded ends) evaluated as a
 *    signed distance in world units, so dashes look like drawn strokes rather
 *    than chopped-off geometry, and the ratio/length can change without the
 *    ends ever going square.
 *  - antialiasing: the same distance drives a fwidth-based alpha ramp, which a
 *    hard discard can't do — at this zoom the dash edges are only a couple of
 *    pixels wide and crawled badly while the camera moved.
 * Shading is deliberately near-flat (the ribbon lies on the ground, so its
 * normal is constant); only a slight darkening towards the outline gives the
 * stroke definition against the terrain.
 */
const RouteLineMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#215761"),
    uProgress: 0,
    uOpacity: 1,
    uDashed: 0,
    uDashRepeat: 1,
    uDashRatio: 0.5,
    uDashLength: 0.16,
    uHalfWidth: RIBBON_HALF_WIDTH,
  },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform vec3 uColor;
    uniform float uProgress;
    uniform float uOpacity;
    uniform float uDashed;
    uniform float uDashRepeat;
    uniform float uDashRatio;
    uniform float uDashLength;
    uniform float uHalfWidth;
    varying vec2 vUv;

    void main() {
      if (vUv.x > uProgress) discard;

      // Across-the-ribbon offset in world units, so the distance field below is
      // isotropic (a rounded end is as round as the ribbon is wide).
      float across = (vUv.y - 0.5) * 2.0 * uHalfWidth;

      float dist;
      if (uDashed > 0.5) {
        float phase = fract(vUv.x * uDashRepeat);
        float along = (phase - uDashRatio * 0.5) * uDashLength;
        // Capsule: a segment of half-length (halfLen - r) inflated by r. Clamped
        // so a short dash degenerates into a dot instead of inverting.
        float r = uHalfWidth;
        float halfLen = max(uDashRatio * uDashLength * 0.5, r);
        vec2 q = vec2(max(abs(along) - (halfLen - r), 0.0), across);
        dist = length(q) - r;
      } else {
        dist = abs(across) - uHalfWidth;
      }

      float aa = fwidth(dist) + 1e-5;
      float coverage = 1.0 - smoothstep(-aa, aa, dist);
      if (coverage < 0.01) discard;

      // Darker towards the outline: a drawn stroke's edge, and enough contrast
      // that the line still reads where it crosses same-toned terrain.
      float rim = smoothstep(-uHalfWidth * 0.45, 0.0, dist);
      vec3 lit = mix(uColor, uColor * 0.72, rim);

      gl_FragColor = vec4(lit, uOpacity * coverage);

      // uColor comes straight from transportModes in src/data/data.ts — the same
      // hex the 2D TripMap draws its route segments with. Without this include a
      // drei shaderMaterial writes working-space values into an sRGB
      // framebuffer, so the 3D lines rendered about two stops darker than the
      // identical colour in the 2D fallback. This is what makes #215761 actually
      // be #215761 on screen.
      #include <colorspace_fragment>
    }
  `,
);

extend({ RouteLineMaterial });

/**
 * drei's shaderMaterial() factory applies these as real uniforms at runtime
 * regardless of how the JSX element is typed, but ThreeElements["shaderMaterial"]
 * only knows the generic base props (transparent, side, ...), not this
 * material's own uniform names - so passing uColor/uDashed/etc as JSX props
 * (RouteLine3D below does, unlike Water.tsx's ref-only/imperative approach)
 * needs this explicit intersection to type-check.
 */
interface RouteLineMaterialUniforms {
  uColor: THREE.Color | string;
  uProgress: number;
  uOpacity: number;
  uDashed: number;
  uDashRepeat: number;
  uDashRatio: number;
  uDashLength: number;
  uHalfWidth: number;
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    routeLineMaterial: ThreeElements["shaderMaterial"] & Partial<RouteLineMaterialUniforms>;
  }
}

interface RouteLineMaterialInstance extends THREE.ShaderMaterial, RouteLineMaterialUniforms {}

interface RouteLine3DProps {
  from: WorldPoint;
  to: WorldPoint;
  mode: TransportMode;
  index: number;
  dimmed: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Shared with Train3D.tsx, so a train riding a train-mode segment follows
 * the exact curve its route line draws, not a visually-close approximation.
 *
 * Terrain-aware rather than assuming flat ISLAND_TOP_Y everywhere: the
 * Kandy–Ella train leg cuts straight through the hill country, and a curve
 * pinned to the (lower) lowland height there sits inside the Highlands
 * tiers — the line and the train riding it both render fully hidden inside
 * the mountain. Anchoring each endpoint (and the midpoint) to the real
 * ground height it sits on fixes that, and is a no-op everywhere else since
 * getTerrainSurfaceY already returns flat ISLAND_TOP_Y off the highlands.
 */
export function buildRouteCurve(from: WorldPoint, to: WorldPoint): THREE.QuadraticBezierCurve3 {
  const start = new THREE.Vector3(from.x, getTerrainSurfaceY(from.x, from.z) + ROUTE_LIFT, from.z);
  const end = new THREE.Vector3(to.x, getTerrainSurfaceY(to.x, to.z) + ROUTE_LIFT, to.z);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const midTerrainY = getTerrainSurfaceY(mid.x, mid.z) + ROUTE_LIFT;
  const length = start.distanceTo(end);
  // Heel licht gebogen: a gentle hop, capped so long legs don't arc absurdly high,
  // over whichever is higher — the endpoints' midpoint or the actual terrain
  // it passes over (a ridge between two lower points, say).
  // Tuned against the island's height, not its width: the arc was sized when the
  // land stood 0.66 above the sea, and at the current 0.13 the old 0.4 ceiling
  // threw a rainbow three times the height of the terrain it spans.
  mid.y = Math.max(mid.y, midTerrainY) + Math.min(length * 0.03, 0.12);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

/**
 * A flat strip following the curve: two vertices per sample, offset sideways
 * along the horizontal perpendicular of the tangent, all normals pointing up.
 *
 * Each sample is also floored to the terrain under it, not just to the curve.
 * The curve only hops over the *midpoint's* height, so on a slope (the climb
 * out of Kandy, say) the line used to sink into the hillside between samples —
 * something the tube hid behind its own thickness and a ribbon cannot.
 */
function buildRibbonGeometry(curve: THREE.QuadraticBezierCurve3): THREE.BufferGeometry {
  const positions = new Float32Array((RIBBON_SEGMENTS + 1) * 2 * 3);
  const normals = new Float32Array((RIBBON_SEGMENTS + 1) * 2 * 3);
  const uvs = new Float32Array((RIBBON_SEGMENTS + 1) * 2 * 2);
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();

  for (let i = 0; i <= RIBBON_SEGMENTS; i++) {
    const t = i / RIBBON_SEGMENTS;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    side.crossVectors(tangent, up).normalize().multiplyScalar(RIBBON_HALF_WIDTH);

    const y = Math.max(point.y, getTerrainSurfaceY(point.x, point.z) + ROUTE_LIFT);

    for (let s = 0; s < 2; s++) {
      const sign = s === 0 ? -1 : 1;
      const v = (i * 2 + s) * 3;
      positions[v] = point.x + side.x * sign;
      positions[v + 1] = y;
      positions[v + 2] = point.z + side.z * sign;
      normals[v + 1] = 1;
      const u = (i * 2 + s) * 2;
      uvs[u] = t;
      uvs[u + 1] = s;
    }

    if (i < RIBBON_SEGMENTS) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

export function RouteLine3D({ from, to, mode, index, dimmed, prefersReducedMotion }: RouteLine3DProps) {
  const materialRef = useRef<RouteLineMaterialInstance>(null);
  const color = useMemo(() => new THREE.Color(mode.color), [mode.color]);
  const dashed = mode.style === "dashed";
  const delay = DRAW_DELAY_BASE + index * DRAW_DELAY_STEP;

  const { geometry, dashRepeat, dashLength } = useMemo(() => {
    const curve = buildRouteCurve(from, to);
    const geometry = buildRibbonGeometry(curve);
    const length = curve.getLength();
    const dashRepeat = Math.max(1, Math.round(length / DASH_WORLD_LENGTH));
    // The actual world length of one dash period after rounding, so the shader's
    // capsule ends stay circular instead of stretching on short legs.
    return { geometry, dashRepeat, dashLength: length / dashRepeat };
  }, [from.x, from.z, to.x, to.z]);

  useFrame(({ clock }, delta) => {
    const material = materialRef.current;
    if (!material) return;

    material.uProgress = prefersReducedMotion
      ? 1
      : easeInOutCubic(THREE.MathUtils.clamp((clock.elapsedTime - delay) / DRAW_DURATION, 0, 1));

    const targetOpacity = dimmed ? DIMMED_OPACITY : 1;
    material.uOpacity = prefersReducedMotion
      ? targetOpacity
      : THREE.MathUtils.damp(material.uOpacity, targetOpacity, OPACITY_LAMBDA, delta);
  });

  return (
    <mesh geometry={geometry}>
      <routeLineMaterial
        ref={materialRef}
        uColor={color}
        uDashed={dashed ? 1 : 0}
        uDashRepeat={dashRepeat}
        uDashRatio={DASH_RATIO}
        uDashLength={dashLength}
        uHalfWidth={RIBBON_HALF_WIDTH}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
