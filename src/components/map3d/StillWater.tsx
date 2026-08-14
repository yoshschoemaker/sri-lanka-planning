import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";

/**
 * Shading for the island's *inland* water: the hill-country lakes, the ancient
 * dry-zone irrigation tanks, the Mahaweli, and Ravana Falls.
 *
 * Deliberately not Water.tsx's LagoonMaterial. That one is built around a single
 * huge plane centred on the island: its depth gradient, foam ring and sparkle
 * falloff are all functions of distance from the world origin, which is exactly
 * right for "the sea around Sri Lanka" and meaningless for a 0.2-unit lake
 * somewhere up a mountain. This is the small-body version: shallow-to-deep across
 * the body's own UVs, a soft ripple, a bright rim where it meets the bank, and the
 * same uNight darkening so inland water dims in step with the sea and the sky.
 *
 * Follows the established convention (see RouteLine3D.tsx's note): drei's
 * shaderMaterial + extend + the TS module augmentation, rather than
 * onBeforeCompile injection.
 *
 * ## UV convention
 *
 * Every geometry using this material must author its UVs as:
 *
 *   u < 0   the damp bank just outside the waterline (see uBank)
 *   u = 0   the waterline itself
 *   u = 1   the deepest point (a lake's centre, a river's centreline, the
 *           middle of a falling sheet)
 *   v       along the flow (around a lake's rim, downstream, or downward)
 *
 * Baking "distance from the bank" straight into u is what lets one shader serve a
 * blob-shaped lake, a long tapering ribbon and a vertical sheet without any of
 * them needing their own depth math — and it's more accurate than deriving depth
 * from a bounding box would be, since the geometry already knows exactly which of
 * its vertices are on the shore.
 *
 * The negative-u band is what stops a lake reading as a sticker on the sand: a
 * flat polygon lifted a hair above the terrain has a hard edge against it, so the
 * geometry extends a little past its own waterline and shades that margin as damp
 * ground, which settles the water into the terrain instead of onto it.
 */

/**
 * Muted, and deliberately close together.
 *
 * These bodies are small on screen — the largest is a fifth of a world unit
 * across. A wide shallow-to-deep gradient plus a bright rim, which is what the
 * first two attempts had, gives a lake the size of a coin three distinct colour
 * bands: it reads as a glowing bullseye, not as water. Keeping the two ends near
 * each other lets the ripple carry the surface instead, and lands the lakes in the
 * same family as Water.tsx's sea, which is the look they should belong to.
 */
const WATER_SHALLOW = new THREE.Color("#66b6cd");
const WATER_DEEP = new THREE.Color("#3f8cab");
const WATER_RIM = new THREE.Color("#cdeaf1");
/**
 * Damp ground at the waterline: a shade or two off the surrounding terrain, not a
 * dark brown. At #7d6f4f it read as a heavy black outline drawn around each lake,
 * which was worse than having no bank at all.
 */
const WATER_BANK = new THREE.Color("#a89571");

const StillWaterMaterial = shaderMaterial(
  {
    uTime: 0,
    /** 0 = full day, 1 = full night. Driven from TripMap3D's DayNightLights, same ref the sea reads. */
    uNight: 0,
    uShallow: WATER_SHALLOW,
    uDeep: WATER_DEEP,
    uRim: WATER_RIM,
    uBank: WATER_BANK,
    /**
     * How fast the surface pattern scrolls along V. 0 for a lake (it only
     * ripples in place); positive for the waterfall and the river, where the
     * water visibly moves downhill.
     */
    uFlow: 0,
    /** Scales the ripple frequency, so a small lake and a long river ribbon get comparable-looking detail despite very different UV spans. */
    uRippleScale: 1,
  },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float uTime;
    uniform float uNight;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uRim;
    uniform vec3 uBank;
    uniform float uFlow;
    uniform float uRippleScale;
    varying vec2 vUv;

    void main() {
      // Flow shifts the pattern along V rather than scrolling the geometry, so a
      // falling sheet or a river reads as moving water without any vertex work.
      vec2 p = vec2(vUv.x, vUv.y - uTime * uFlow) * uRippleScale;

      // Two crossed ripple trains. Kept low-frequency on purpose: the same
      // per-pixel aliasing that made the sea shader flicker on mobile (see
      // Water.tsx) applies just as much here, and these bodies are small enough
      // on screen that a finer pattern would land below one pixel per wave.
      float ripple = sin(p.x * 22.0 + uTime * 0.9) * 0.5 + sin(p.y * 17.0 - uTime * 0.7) * 0.5;

      // u is distance from the bank by convention (see the header), so depth, the
      // shallows and the bank all fall straight out of it.
      float depth = smoothstep(0.0, 0.5, max(vUv.x, 0.0));

      vec3 color = mix(uShallow, uDeep, depth * 0.55);
      // A gentle lightening of the shallows, not the bright halo this started as:
      // at 0.35 on a lake only a few hundred pixels across, the highlight was most
      // of the lake. Ripple contribution kept equally quiet.
      color += uRim * (1.0 - smoothstep(0.0, 0.35, max(vUv.x, 0.0))) * 0.06;
      color += uRim * ripple * 0.03;

      // Outside the waterline: damp ground, fading into the water at u = 0. Also
      // fades toward transparent at its outer edge so it blends into whatever
      // terrain colour happens to be underneath rather than ending in a hard ring.
      float bankBlend = smoothstep(-0.85, -0.04, vUv.x);
      color = mix(uBank, color, bankBlend);
      float alpha = vUv.x >= 0.0 ? 1.0 : smoothstep(-1.0, -0.12, vUv.x);

      // Same treatment as the sea: darken toward navy last, so the rim and
      // ripple highlights dim along with the base rather than staying lit.
      vec3 nightColor = mix(color * 0.24, vec3(0.05, 0.08, 0.16), 0.4);
      color = mix(color, nightColor, uNight);

      gl_FragColor = vec4(color, alpha);
    }
  `,
);

extend({ StillWaterMaterial });

/**
 * drei's shaderMaterial() factory turns these into real uniforms at runtime
 * whatever the JSX element is typed as, but ThreeElements["shaderMaterial"] only
 * knows the generic base props — so setting uFlow/uRippleScale as JSX props (which
 * InlandWater and Waterfall do, since they differ per body) needs this explicit
 * intersection to type-check. Same dance as RouteLine3D.tsx.
 */
interface StillWaterUniforms {
  uTime: number;
  uNight: number;
  uFlow: number;
  uRippleScale: number;
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    stillWaterMaterial: ThreeElements["shaderMaterial"] & Partial<StillWaterUniforms>;
  }
}

export interface StillWaterMaterialInstance extends THREE.ShaderMaterial, StillWaterUniforms {}
