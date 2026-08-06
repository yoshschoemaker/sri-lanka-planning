import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { extend, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";

// Keep in sync with --color-lagoon in src/index.css: a clear ocean blue,
// distinct from the darker car-transport teal so a route line drawn over the
// water still reads against it. Blue (not green) is deliberate: earlier
// muted teal/green tones read as a flat green backdrop rather than water.
// Pushed brighter/more saturated than the CSS swatch: the scene's default
// ACES tone mapping (disabled via Canvas's `flat` prop, but kept here as a
// safety margin) and the sheer amount of dark "deep water" on screen both
// eat into perceived brightness, so the authored colors need headroom.
const LAGOON_SHALLOW = new THREE.Color("#8fe8ec");
const LAGOON_DEEP = new THREE.Color("#1f7fa3");
const LAGOON_HIGHLIGHT = new THREE.Color("#ffffff");
const LAGOON_FOAM = new THREE.Color("#eafcff");

// Same direction as TripMap3D's directionalLight, normalized; drives the
// water's sparkle highlight so glints line up with the scene's actual key
// light instead of an arbitrary second direction.
const LIGHT_DIR = new THREE.Vector3(4.5, 7, 3).normalize();

const LagoonMaterial = shaderMaterial(
  {
    uTime: 0,
    uShallow: LAGOON_SHALLOW,
    uDeep: LAGOON_DEEP,
    uHighlight: LAGOON_HIGHLIGHT,
    uFoam: LAGOON_FOAM,
    uLightDir: LIGHT_DIR,
    /** 0 = full day, 1 = full night; driven by TripMap3D's DayNightLights so the sea darkens along with the sky instead of staying lit at a fixed brightness regardless of scene lighting. */
    uNight: 0,
  },
  `
    uniform float uTime;
    varying vec2 vPos;

    // Same wave train as the fragment shader's height()/waveNormal(), kept in
    // sync manually (no shared-chunk plumbing between the two shader strings):
    // duplicated here so the *geometry* itself rolls instead of only the
    // shading tricks below, which on this diorama's oblique camera angle
    // otherwise read as a static, un-moving sea.
    float height(vec2 p, float t) {
      float w1 = sin(p.x * 1.8 + p.y * 1.1 - t * 0.6);
      float w2 = sin(p.x * 0.9 - p.y * 1.6 - t * 0.42);
      float w3 = sin(length(p) * 1.1 - t * 0.35);
      return w1 * 0.5 + w2 * 0.35 + w3 * 0.4;
    }

    void main() {
      // Plane-local xy, unaffected by the mesh's own rotation/position, so it
      // reads in the same world units as WORLD_SCALE regardless of how big
      // the plane geometry itself is (avoids re-tuning the gradient/shimmer
      // scale whenever the plane's size changes to reach the frustum edges).
      vPos = position.xy;
      // Local +Z is the plane's un-rotated normal, which the mesh's
      // rotation=[-PI/2,0,0] maps to world +Y, i.e. this actually lifts each
      // vertex up/down rather than sliding it sideways.
      vec3 displaced = position + vec3(0.0, 0.0, height(vPos, uTime) * 0.09);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  `
    uniform float uTime;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uHighlight;
    uniform vec3 uFoam;
    uniform vec3 uLightDir;
    uniform float uNight;
    varying vec2 vPos;

    // Three overlapping wave trains (two directional swells + the original
    // radial ripple) summed into one height field. Cheap analytic partial
    // derivatives of that field fake a normal map, so the "sparkle" below
    // reacts to the same motion the eye reads as waves, instead of a static
    // highlight sliding over flat water.
    float height(vec2 p, float t) {
      float w1 = sin(p.x * 1.8 + p.y * 1.1 - t * 0.6);
      float w2 = sin(p.x * 0.9 - p.y * 1.6 - t * 0.42);
      float w3 = sin(length(p) * 1.1 - t * 0.35);
      return w1 * 0.5 + w2 * 0.35 + w3 * 0.4;
    }

    vec3 waveNormal(vec2 p, float t) {
      float eps = 0.05;
      float hL = height(p - vec2(eps, 0.0), t);
      float hR = height(p + vec2(eps, 0.0), t);
      float hD = height(p - vec2(0.0, eps), t);
      float hU = height(p + vec2(0.0, eps), t);
      float dx = (hR - hL) / (2.0 * eps);
      float dy = (hU - hD) / (2.0 * eps);
      return normalize(vec3(-dx * 0.35, 1.0, -dy * 0.35));
    }

    // A much higher-frequency ripple, purely for the sparkle normal: the
    // slow swell above is too smooth to ever produce a *point* highlight,
    // only broad soft glow. Real "sun on water" glitter is small glints
    // clustered inside a broader glow, which is what combining these two
    // normals (below) approximates.
    float microHeight(vec2 p, float t) {
      return sin(p.x * 14.0 + p.y * 9.0 - t * 2.2) + sin(p.x * -11.0 + p.y * 13.0 - t * 1.7);
    }

    vec3 microNormal(vec2 p, float t) {
      float eps = 0.015;
      float hL = microHeight(p - vec2(eps, 0.0), t);
      float hR = microHeight(p + vec2(eps, 0.0), t);
      float hD = microHeight(p - vec2(0.0, eps), t);
      float hU = microHeight(p + vec2(0.0, eps), t);
      float dx = (hR - hL) / (2.0 * eps);
      float dy = (hU - hD) / (2.0 * eps);
      return normalize(vec3(-dx * 0.4, 1.0, -dy * 0.4));
    }

    void main() {
      float dist = length(vPos);

      // Clamp the deep-water blend short of 1.0 so the far field stays a rich
      // teal instead of crushing to near-black once tone mapping/distance
      // both darken it.
      vec3 color = mix(uShallow, uDeep, min(smoothstep(1.2, 7.0, dist), 0.86));

      vec3 lightDir = normalize(uLightDir);
      vec3 n = waveNormal(vPos, uTime);

      // Broad Lambertian shading from the same swell normal used for the
      // sparkle below: unlike the sparse, sharp glow/glint highlights (only
      // ever bright, only ever a tiny point), this shades the *whole*
      // surface darker in the troughs and lighter on the crests, so the
      // swell itself visibly rolls across the water instead of only a
      // twinkle moving over an otherwise static gradient.
      float lambert = dot(n, lightDir) * 0.5 + 0.5;
      color *= mix(0.82, 1.1, lambert);

      float glow = pow(max(dot(n, lightDir), 0.0), 10.0);
      vec3 microN = microNormal(vPos, uTime);
      float glint = pow(max(dot(microN, lightDir), 0.0), 140.0);
      float sparkle = (glow * 0.35 + glint * glow * 2.2);
      sparkle *= 1.0 - smoothstep(5.0, 9.0, dist);
      // Moonlight glints are far dimmer than sunlight ones.
      sparkle *= mix(1.0, 0.3, uNight);
      color += uHighlight * sparkle;

      // Soft ambient shimmer from the original radial ripple, kept subtle so
      // it reads as light-on-water rather than a moving stripe.
      float ripple = sin(dist * 1.1 - uTime * 0.35) * 0.5 + 0.5;
      ripple *= 1.0 - smoothstep(2.5, 7.0, dist);
      color += uHighlight * ripple * 0.06 * mix(1.0, 0.4, uNight);

      // A pulsing, slightly wobbly foam line where the lagoon meets the
      // island's bevel, echoing the coastline's own irregularity instead of
      // a perfectly circular ring.
      float angle = atan(vPos.y, vPos.x);
      float wobble = sin(angle * 5.0 + uTime * 0.5) * 0.15;
      float foamBand = smoothstep(1.05 + wobble, 1.35 + wobble, dist) * (1.0 - smoothstep(1.55 + wobble, 1.95 + wobble, dist));
      float foamTexture = 0.55 + 0.45 * sin(dist * 14.0 - uTime * 1.6 + angle * 4.0);
      color = mix(color, uFoam, foamBand * foamTexture * 0.55);

      // Darken toward a deep navy last, so it dims the sparkle/foam contributions
      // above too instead of just tinting the base gradient underneath them.
      vec3 nightColor = mix(color * 0.22, vec3(0.04, 0.07, 0.15), 0.4);
      color = mix(color, nightColor, uNight);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
);

extend({ LagoonMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    lagoonMaterial: ThreeElements["shaderMaterial"];
  }
}

interface LagoonMaterialInstance extends THREE.ShaderMaterial {
  uTime: number;
  uNight: number;
}

/** Subdivided plane beneath the island; the vertex shader displaces it into rolling waves, matched to the fragment shader's wave-based shading. */
export function Water({ nightRef }: { nightRef: RefObject<number> }) {
  const materialRef = useRef<LagoonMaterialInstance>(null);

  useFrame((_state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    material.uTime += delta;
    material.uNight = nightRef.current;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
      {/* 64 segments resolves the ~3.5-unit wave wavelength across the 60-unit
          plane without the vertex count getting out of hand. */}
      <planeGeometry args={[60, 60, 64, 64]} />
      {/* Most mobile GPUs default WebGL fragment shaders to mediump; the high-frequency
          sin()/pow() terms above (glint's pow(..., 140.0) especially) lose enough precision
          at mediump to flicker/dither once uTime grows, which desktop's highp default never
          shows. Forcing highp here (three.js silently caps it if the device truly can't do
          highp fragment) fixes that without touching the wave math. */}
      <lagoonMaterial ref={materialRef} precision="highp" />
    </mesh>
  );
}
