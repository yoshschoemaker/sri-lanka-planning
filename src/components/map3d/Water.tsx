import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { extend, useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { useDetailLevel } from "../../utils/useDetailLevel";
import { useReducedMotion } from "../../utils/useReducedMotion";
import { SEA_LEVEL_Y } from "./seaLevel";
import { OCEAN_SHORE_GLSL, OCEAN_SURFACE_GLSL } from "./oceanShader";
import { buildSeaShoreField, SEA_FIELD_TEXEL } from "./seaDistanceField";
import { buildSeaGeometry } from "./seaGeometry";

/**
 * Authored as plain sRGB, and now that actually means something.
 *
 * This shader used to write its working-space (linear) colours straight into an
 * sRGB framebuffer, because a drei shaderMaterial gets no `<colorspace_fragment>`
 * unless it asks for one. Everything came out roughly two stops dark — #8fe8ec
 * displayed as #46ced6 — which is what the old comment here was compensating for
 * when it said the colours "need headroom". Worse, it was silently
 * inconsistent: the meshStandardMaterials on the island right next to the water
 * converted correctly, and TripMap3D's HORIZON_DAY was derived from these two
 * colours by arithmetic in sRGB, so the backdrop ended up about twice as bright
 * as the far sea it was supposed to disappear into.
 *
 * The include is at the bottom of the fragment shader now, so these are the
 * colours that reach the screen.
 */
const LAGOON_SHALLOW = new THREE.Color("#5fd3d8");
const LAGOON_DEEP = new THREE.Color("#10527c");
const LAGOON_FOAM = new THREE.Color("#f4fcff");

/**
 * The seabed showing through the shallows. Matches WET_SAND in Island.tsx, which
 * is not exported: the sand slab's submerged wall and the water covering it have
 * to be the same sand or the shoal reads as a painted ring rather than as the
 * beach continuing underwater.
 */
const LAGOON_SEABED = new THREE.Color("#b8905f");

/**
 * The sea's own reconstruction of a sky to reflect, since the scene has no
 * environment map and no sky dome.
 *
 * Only the *horizon* end has to agree with anything, and that one is not a
 * constant here at all — it is read live from `scene.background`, the same
 * THREE.Color DayNightLights lerps every frame. So the far sea and the backdrop
 * cannot drift apart, and there is no second copy of HORIZON_DAY to keep in
 * sync. The zenith is the water's own business.
 */
const ZENITH_DAY = new THREE.Color("#a9dcf0");
const ZENITH_NIGHT = new THREE.Color("#16233d");

/** Matches DAY_LIGHTS.key / NIGHT_LIGHTS.key in TripMap3D, so the glitter on the water is the colour of the light that is making it. */
const SUN_DAY = new THREE.Color("#ffddb3");
const SUN_NIGHT = new THREE.Color("#93a8de");

/** Where the night darkening lands before the haze gets the last word. */
const NIGHT_TINT = new THREE.Color("#1a2a4a");

/**
 * How bright the reflected sun disc is, relative to the sky around it.
 *
 * Absurd-looking on purpose. Fresnel at this camera's angles is about 0.02
 * looking down at the water, so a sun scaled to anything like the sky's own
 * brightness produces no glitter at all through it — which is exactly why the
 * old shader faked the effect with pow(dot(n, lightDir), 48), a diffuse term
 * dressed up as a highlight. A physically bright sun reflected through a
 * physical fresnel term gives the real thing: small, hard glints that appear
 * and vanish as individual wave faces turn through the mirror angle.
 */
const SUN_INTENSITY_DAY = 55;
/** Moonglitter is the same effect, two orders of magnitude dimmer. */
const SUN_INTENSITY_NIGHT = 6;

/** Same direction as TripMap3D's key directionalLight, so the glitter track lines up with the light the rest of the scene is lit by. */
const LIGHT_DIR = new THREE.Vector3(4.5, 7, 3).normalize();

/**
 * Aerial perspective, in view-distance units.
 *
 * Two jobs. The obvious one is depth: distant water should wash out, and
 * without it the sea is uniformly saturated to the edge of the frame. The
 * load-bearing one is that everything past uHazeFar is *exactly* the scene
 * background colour, so the disc's outer rim stops existing rather than merely
 * being hard to spot. That matters at the camera's maximum 75-degree polar
 * angle, where the rim is genuinely inside the frame; the furthest vertex sits
 * ~50 units from the camera there, comfortably past the far value below.
 *
 * Not three.js fog. This is a raw ShaderMaterial and gets no fog chunks, which
 * is the same reason TripMap3D reached for a scene background instead of fog in
 * the first place.
 */
const HAZE_NEAR = 16;
const HAZE_FAR = 34;

const LagoonMaterial = shaderMaterial(
  {
    uTime: 0,
    /** 0 = full day, 1 = full night; driven by TripMap3D's DayNightLights so the sea darkens along with the sky. */
    uNight: 0,
    uShore: null,
    uShoreWindow: new THREE.Vector4(),
    uLightDir: LIGHT_DIR,
    uSun: SUN_DAY.clone(),
    uSunIntensity: SUN_INTENSITY_DAY,
    uHorizon: new THREE.Color("#2d88a6"),
    uZenith: ZENITH_DAY.clone(),
    uShallow: LAGOON_SHALLOW,
    uDeep: LAGOON_DEEP,
    uSeabed: LAGOON_SEABED,
    uFoam: LAGOON_FOAM,
    uNightTint: NIGHT_TINT,
    uHazeNear: HAZE_NEAR,
    uHazeFar: HAZE_FAR,
  },
  /* glsl */ `
    uniform float uTime;

    /** Baked by seaGeometry from seaDistanceField: x = signed distance offshore, yz = offshore direction, w = shelf width. */
    attribute vec4 aShore;

    varying vec3 vWorld;
    varying vec2 vSurface;

    ${OCEAN_SURFACE_GLSL}

    void main() {
      // seaGeometry builds the disc flat in XZ and the mesh carries no rotation,
      // so this is world XZ directly. The old sea was a plane rotated -90
      // degrees about X, which meant reading position.xy as a stand-in for world
      // XZ and a comment explaining the indirection.
      vec2 p = position.xz;
      vSurface = p;

      // From the attribute rather than from the field texture: sampling a
      // texture in the vertex stage needs an explicit LOD in GLSL ES, which is
      // easy to get away with on desktop and fails on a phone.
      float shore = max(aShore.x, 0.0);
      vec2 shoreDir = dot(aShore.yz, aShore.yz) > 0.25 ? normalize(aShore.yz) : vec2(1.0, 0.0);

      OceanAcc acc = oceanSurface(p, uTime, shore, shoreDir);

      vec3 displaced = position + acc.offset;
      vWorld = (modelMatrix * vec4(displaced, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  /* glsl */ `
    uniform float uTime;
    uniform float uNight;
    uniform vec3 uLightDir;
    uniform vec3 uSun;
    uniform float uSunIntensity;
    uniform vec3 uHorizon;
    uniform vec3 uZenith;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uSeabed;
    uniform vec3 uFoam;
    uniform vec3 uNightTint;
    uniform float uHazeNear;
    uniform float uHazeFar;

    varying vec3 vWorld;
    varying vec2 vSurface;

    ${OCEAN_SHORE_GLSL}
    ${OCEAN_SURFACE_GLSL}

    /**
     * Just enough sky to reflect. uHorizon is the scene's actual background
     * colour, so a grazing reflection returns the very pixel value the backdrop
     * is painted with.
     *
     * discPower is passed in rather than fixed because it comes from how fast
     * the normal is varying across this particular pixel — see the note on
     * rough in main().
     */
    vec3 oceanSky(vec3 direction, float discPower) {
      vec3 sky = mix(uHorizon, uZenith, pow(clamp(direction.y, 0.0, 1.0), 0.55));
      float sun = max(dot(direction, normalize(uLightDir)), 0.0);
      sky += uSun * pow(sun, discPower) * uSunIntensity;
      // A broad halo around the disc. Cheap, and it carries most of the "sun on
      // water" read on devices where the tight disc lands between pixels.
      sky += uSun * pow(sun, 12.0) * 0.10;
      return sky;
    }

    /**
     * Ripples finer than the vertex grid can carry, perturbing the normal only.
     *
     * pixelWorld is how much world space this pixel covers, so each component
     * fades out once a pixel spans a meaningful fraction of its wavelength.
     * That replaces the old shader's blunt global rule — frequencies "kept well
     * below screen-pixel frequency at typical camera distance", a single
     * compromise applied everywhere — with a per-pixel one. Near the camera the
     * detail is now free to be finer than that rule allowed; far away it
     * genuinely stops resolving instead of merely being tuned not to sparkle.
     */
    vec3 oceanDetailNormal(vec3 n, vec2 p, float t, float pixelWorld) {
      float k1 = 9.0;
      float k2 = 21.0;
      float fade1 = 1.0 - smoothstep(0.5, 1.2, pixelWorld * k1);
      float fade2 = 1.0 - smoothstep(0.5, 1.2, pixelWorld * k2);
      vec2 d1 = vec2(0.86, 0.51);
      vec2 d2 = vec2(-0.42, 0.91);
      float a1 = cos(dot(d1, p) * k1 - t * 2.3) * 0.020 * fade1;
      float a2 = cos(dot(d2, p) * k2 - t * 3.1) * 0.008 * fade2;
      n.x -= d1.x * k1 * a1 + d2.x * k2 * a2;
      n.z -= d1.y * k1 * a1 + d2.y * k2 * a2;
      return normalize(n);
    }

    void main() {
      vec2 p = vSurface;

      vec4 field = texture2D(uShore, oceanShoreUv(p));
      // Clamped for hygiene rather than correctness: the part of the disc that
      // overlaps land is hidden inside the opaque sand slab, and renderOrder
      // puts the sea last so those fragments are rejected by early depth test
      // before they reach here.
      float shore = max(field.r, 0.0);
      vec2 shoreDir = dot(field.gb, field.gb) > 0.25 ? normalize(field.gb) : vec2(1.0, 0.0);
      // Wide, gently shelving water where the beach is wide; a quick drop where
      // it is narrow. See seaDistanceField for why the beach width is a fair
      // stand-in for bathymetry.
      float shelf = mix(0.55, 1.60, clamp(field.a, 0.0, 1.0));

      // Same function, same numbers as the vertex stage — see oceanShader.ts.
      // The two read the shore field through different plumbing (attribute
      // there, texture here), so they can disagree by the field's own
      // interpolation error, under 0.01 near the coast. That shifts the
      // refraction blend imperceptibly and cannot move the surface height at
      // all, since the amplitude does not depend on position.
      OceanAcc acc = oceanSurface(p, uTime, shore, shoreDir);
      float pixelWorld = max(fwidth(p.x), fwidth(p.y));
      vec3 n = oceanDetailNormal(acc.normal, p, uTime, pixelWorld);

      vec3 toCamera = cameraPosition - vWorld;
      float viewDist = length(toCamera);
      vec3 V = toCamera / viewDist;
      vec3 L = normalize(uLightDir);
      float crest = acc.height;
      float lambert = dot(n, L) * 0.5 + 0.5;

      // ---- foam -----------------------------------------------------------
      // Run-up that follows the coast and surges in and out with the swell,
      // phased *along* the shore so it never pulses as one ring the way a
      // radius-keyed band does however much wobble is added to it.
      float along = dot(p, vec2(-shoreDir.y, shoreDir.x));
      float surge = sin(uTime * 1.15 - shore * 5.5 + along * 2.1) * 0.5 + 0.5;
      float runup = 1.0 - smoothstep(0.0, 0.16 + 0.10 * surge, shore);
      float breakup = oceanNoise(p * 7.0 + vec2(0.0, uTime * 0.35)) * 0.65
                    + oceanNoise(p * 15.0 - vec2(uTime * 0.50, 0.0)) * 0.35;
      float shoreFoam = smoothstep(0.30, 0.85, runup * (0.55 + 0.70 * breakup));
      // Whitecaps ride steep wave tops, and only outside the run-up band, which
      // owns the shallows. Multiplying by the shore ramp is what puts the surf
      // line just off the beach rather than spread evenly over open water.
      float whitecap = smoothstep(0.62, 0.95, crest)
                     * smoothstep(0.30, 0.90, shore)
                     * smoothstep(0.35, 0.80, breakup);
      float foam = clamp(shoreFoam + whitecap, 0.0, 1.0);

      // ---- the water body -------------------------------------------------
      float depth01 = smoothstep(0.0, 1.45 * shelf, shore);
      vec3 body = mix(uShallow, uDeep, depth01 * 0.92);

      float floorVisible = exp(-depth01 * 4.5);
      if (floorVisible > 0.02) {
        // There is no seabed geometry, so this stands in for one. Offsetting the
        // caustic pattern by the surface normal is what makes the veining track
        // the waves overhead instead of sliding independently underneath them.
        vec3 seabed = uSeabed + uSun * oceanCaustics(p * 6.5 + n.xz * 2.2, uTime) * 0.50 * (1.0 - uNight);
        body = mix(body, mix(body, seabed, 0.62), floorVisible);
      }

      // Light coming through the back of a crest, strongest with the camera
      // roughly opposite the sun — which is when a real wave lights up from
      // behind just before it breaks.
      float backlit = clamp(dot(V, normalize(vec3(-L.x, 0.0, -L.z))) * 0.5 + 0.5, 0.0, 1.0);
      body += uShallow * pow(clamp(crest, 0.0, 1.0), 2.5) * pow(backlit, 3.0) * 0.45 * (1.0 - uNight);

      body *= mix(0.86, 1.12, lambert);

      // ---- what the surface mirrors ---------------------------------------
      // Specular antialiasing: widen the highlight by how much the normal varies
      // inside this pixel. This is what lets the near-field glint be genuinely
      // tight, where the old shader had to hold its exponent at a "moderate
      // rather than razor-thin" 48 everywhere to stop mobile from strobing. The
      // widening is local and automatic now, so the compromise is gone.
      float rough = clamp(0.05 + length(fwidth(n)) * 1.8, 0.05, 0.70);
      float discPower = 2.0 / (rough * rough) - 2.0;

      vec3 R = reflect(-V, n);
      // A wave face tilted away from the camera would otherwise mirror the
      // underside of a world that does not exist.
      R.y = abs(R.y);
      vec3 reflected = oceanSky(R, discPower);

      // The island in the water. Not a mirror pass: the land stands only ~0.13
      // above mean sea level at the shore, so a real planar reflection is a
      // dozen pixels tall at this framing and costs a second render of the whole
      // scene. Bleeding the sand's own colour outward along the baked shore
      // normal is what the eye reads from those pixels anyway.
      float bleed = (1.0 - smoothstep(0.0, 0.40, shore))
                  * clamp(dot(n.xz, -shoreDir) * 2.0 + 0.35, 0.0, 1.0);
      reflected = mix(reflected, uSeabed, bleed * 0.45);

      // Foam is rough and opaque, so it kills both the mirror and the glint.
      float fresnel = (0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0)) * (1.0 - foam * 0.85);

      vec3 color = mix(body, reflected, fresnel);
      color = mix(color, uFoam * (0.72 + 0.32 * lambert), foam * 0.92);

      // Night before haze, so the haze colour — already day/night blended on the
      // CPU — has the last word rather than being darkened twice.
      color = mix(color, mix(color * 0.22, uNightTint, 0.4), uNight);

      color = mix(color, uHorizon, smoothstep(uHazeNear, uHazeFar, viewDist));

      gl_FragColor = vec4(color, 1.0);

      // The line this shader has been missing. See the palette note at the top:
      // without it every colour above is written to the framebuffer in working
      // space and displays about two stops dark.
      #include <colorspace_fragment>
    }
  `,
);

extend({ LagoonMaterial });

interface LagoonUniforms {
  uTime: number;
  uNight: number;
  uShore: THREE.Texture | null;
  uShoreWindow: THREE.Vector4;
  uSun: THREE.Color;
  uSunIntensity: number;
  uHorizon: THREE.Color;
  uZenith: THREE.Color;
}

/**
 * drei's shaderMaterial() factory turns these into real uniforms at runtime
 * whatever the JSX element is typed as, but ThreeElements["shaderMaterial"] only
 * knows the generic base props — so setting uShore/uShoreWindow as JSX props
 * needs this explicit intersection to type-check. Same dance as RouteLine3D and
 * StillWater.
 */
declare module "@react-three/fiber" {
  interface ThreeElements {
    lagoonMaterial: ThreeElements["shaderMaterial"] & Partial<LagoonUniforms>;
  }
}

interface LagoonMaterialInstance extends THREE.ShaderMaterial, LagoonUniforms {}

/**
 * The sea: a Gerstner swell on a shore-aware polar disc, shaded by what it
 * reflects rather than by a diffuse term standing in for a highlight.
 *
 * Three things do most of the work, in order of how much they change:
 *  - Fresnel and a real reflected sun (oceanSky). The view vector appears
 *    nowhere in the old shader, so every pixel of it was equally shiny whether
 *    the camera was looking straight down at the water or grazing along it.
 *  - The baked shore field (seaDistanceField). Everything that used to be a
 *    circle centred on the world origin — depth, foam, sparkle falloff — now
 *    follows the actual coastline.
 *  - Gerstner components with exact analytic normals (oceanShader), on a disc
 *    that spends its vertices near the island (seaGeometry).
 */
export function Water({ nightRef }: { nightRef: RefObject<number> }) {
  const materialRef = useRef<LagoonMaterialInstance>(null);
  const detail = useDetailLevel();
  const prefersReducedMotion = useReducedMotion();

  // Read here rather than threaded down from TripMap3D: both are hooks over a
  // media query, so there is nothing to lift.
  const field = useMemo(() => buildSeaShoreField(SEA_FIELD_TEXEL[detail]), [detail]);
  const geometry = useMemo(() => buildSeaGeometry(detail, field), [detail, field]);

  useEffect(() => {
    return () => {
      field.dispose();
      geometry.dispose();
    };
  }, [field, geometry]);

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    // Frozen rather than flattened under reduced motion: Island.tsx paints wet
    // sand up to the crest of the swell, so a dead-flat sea would leave a
    // permanently dry band at the waterline.
    if (!prefersReducedMotion) material.uTime += delta;

    const night = nightRef.current;
    material.uNight = night;

    // The live background colour, not a copy of TripMap3D's constants, so the
    // far sea and the backdrop are the same pixel value by construction.
    const background = state.scene.background;
    if (background instanceof THREE.Color) material.uHorizon.copy(background);

    material.uZenith.copy(ZENITH_DAY).lerp(ZENITH_NIGHT, night);
    material.uSun.copy(SUN_DAY).lerp(SUN_NIGHT, night);
    material.uSunIntensity = THREE.MathUtils.lerp(SUN_INTENSITY_DAY, SUN_INTENSITY_NIGHT, night);
  });

  return (
    // renderOrder 1 draws the sea after the island, so early depth test rejects
    // the large part of the disc that is hidden inside the slab. No rotation:
    // seaGeometry already builds it flat.
    <mesh geometry={geometry} position={[0, SEA_LEVEL_Y, 0]} renderOrder={1}>
      {/* Most mobile GPUs default fragment shaders to mediump, and this shader has
          two terms that need better than that: the sun disc's pow() runs to an
          exponent in the hundreds, and oceanHash multiplies fract()ed values
          together. Both dither at mediump once uTime grows, which desktop's highp
          default never shows. three silently caps this if a device truly cannot
          do highp fragment. */}
      <lagoonMaterial
        ref={materialRef}
        precision="highp"
        uShore={field.texture}
        uShoreWindow={field.window}
      />
    </mesh>
  );
}
