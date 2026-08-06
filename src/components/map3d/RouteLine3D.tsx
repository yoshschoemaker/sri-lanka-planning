import { useMemo, useRef } from "react";
import * as THREE from "three";
import { extend, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import type { TransportMode } from "../../types/trip";
import type { WorldPoint } from "../../utils/projection3d";
import { getTerrainSurfaceY } from "./Highlands";

const TUBE_RADIUS = 0.028;
/** Exported so Train3D.tsx can rebuild the exact same curve for train-mode segments. */
export const ROUTE_LIFT = 0.04;
const TUBULAR_SEGMENTS = 24;
const RADIAL_SEGMENTS = 6;

/** Same stagger timing as TripMap.tsx's 2D route draw-on. */
const DRAW_DELAY_BASE = 0.2;
const DRAW_DELAY_STEP = 0.14;
const DRAW_DURATION = 0.9;

const DASH_WORLD_LENGTH = 0.22;
const DASH_RATIO = 0.55;

/** Matches TripMap.tsx's route-segment dim value exactly, for visual parity with the 2D fallback. */
const DIMMED_OPACITY = 0.25;
const OPACITY_LAMBDA = 10;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * One shader does both jobs the plan asks for, gated on TubeGeometry's own
 * uv.x (already normalized 0..1 along the tube's length):
 *  - draw-on reveal: discard fragments beyond uProgress.
 *  - tuktuk dash pattern: discard fragments outside each dash's "on" phase.
 * Lighting is a hand-rolled single-direction diffuse term (no specular, so
 * effectively "high roughness / no metalness") rather than PBR uniforms,
 * since a bespoke ShaderMaterial has no roughness/metalness of its own; this
 * mirrors Water.tsx's existing custom-shaderMaterial convention rather than
 * introducing onBeforeCompile injection into a standard material.
 */
const RouteLineMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#215761"),
    uProgress: 0,
    uOpacity: 1,
    uDashed: 0,
    uDashRepeat: 1,
    uDashRatio: 0.6,
  },
  `
    varying vec2 vUv;
    varying vec3 vNormalW;
    void main() {
      vUv = uv;
      vNormalW = normalize(mat3(modelMatrix) * normal);
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
    varying vec2 vUv;
    varying vec3 vNormalW;

    void main() {
      if (vUv.x > uProgress) discard;
      if (uDashed > 0.5 && fract(vUv.x * uDashRepeat) > uDashRatio) discard;

      vec3 lightDir = normalize(vec3(0.45, 0.7, 0.3));
      float diffuse = max(dot(vNormalW, lightDir), 0.0);
      vec3 lit = uColor * (0.6 + 0.4 * diffuse);

      gl_FragColor = vec4(lit, uOpacity);
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
  mid.y = Math.max(mid.y, midTerrainY) + Math.min(length * 0.07, 0.4);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

export function RouteLine3D({ from, to, mode, index, dimmed, prefersReducedMotion }: RouteLine3DProps) {
  const materialRef = useRef<RouteLineMaterialInstance>(null);
  const color = useMemo(() => new THREE.Color(mode.color), [mode.color]);
  const dashed = mode.style === "dashed";
  const delay = DRAW_DELAY_BASE + index * DRAW_DELAY_STEP;

  const { geometry, dashRepeat } = useMemo(() => {
    const curve = buildRouteCurve(from, to);
    const geometry = new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, TUBE_RADIUS, RADIAL_SEGMENTS, false);
    const dashRepeat = Math.max(1, Math.round(curve.getLength() / DASH_WORLD_LENGTH));
    return { geometry, dashRepeat };
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
        transparent
      />
    </mesh>
  );
}
