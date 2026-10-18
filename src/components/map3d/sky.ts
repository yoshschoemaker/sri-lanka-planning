import * as THREE from "three";

/** Same direction as TripMap3D's key directionalLight, so the sea is shaded by the light the rest of the scene is lit by. */
export const LIGHT_DIR = new THREE.Vector3(4.5, 7, 3).normalize();

/**
 * Where the visible sun stands (Sun3D), down on the horizon.
 *
 * Deliberately *not* the key light's bearing. That light comes from behind the
 * default camera, so a sun there could never even glow into the overview.
 * This one stands behind the island as seen from the default camera (which
 * sits at azimuth 20°), nudged a little to the right of centre, so the far
 * sea at the top of the overview catches its glow. The key light stays high
 * and where it was — a sun this low would light the island almost edge-on —
 * so this direction drives what can be *seen*: the disc, its glow, the
 * glitter it reflects on the sea, and the warm back-light rim in TripMap3D.
 */
const SUN_AZIMUTH_DEG = 185;
const SUN_ELEVATION_DEG = 1.6;
export const SUN_DIR = new THREE.Vector3(
  Math.sin(THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG)),
  0,
  Math.cos(THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG)),
)
  .multiplyScalar(Math.cos(THREE.MathUtils.degToRad(SUN_ELEVATION_DEG)))
  .setY(Math.sin(THREE.MathUtils.degToRad(SUN_ELEVATION_DEG)));

export const SUN_GLOW_DAY = new THREE.Color("#ffb867");
/** Pale and cool, matching NIGHT_LIGHTS' key: the same body reads as the moon once evening falls. */
export const SUN_GLOW_NIGHT = new THREE.Color("#7f95cc");

/**
 * How much sun glow the sky carries in a given view direction, in units of
 * the glow colour. Shared by Sun3D, which adds it to the backdrop, and Water,
 * which hazes its far field into backdrop *plus* this — without that the glow
 * stops dead where the sea starts and draws a hard line along the horizon.
 *
 * Needs `uniform vec3 uSunDir;` and `uniform float uNight;` declared first.
 * Symmetric about the horizon on purpose: below it is where the sea's haze
 * takes over, and the two have to agree there.
 */
export const SKY_GLOW_GLSL = /* glsl */ `
  float skyGlow(vec3 dir) {
    float c = dot(dir, uSunDir);
    float angle = acos(clamp(c, -1.0, 1.0));
    // A tight corona, and a wide one stretched along the horizon the way low
    // sunlight smears through haze.
    float corona = exp(-angle * 22.0) * 0.85;
    vec2 flatSun = normalize(uSunDir.xz);
    vec2 flatDir = normalize(dir.xz + 1e-5);
    float azimuth = acos(clamp(dot(flatSun, flatDir), -1.0, 1.0));
    float band = exp(-azimuth * 2.2) * exp(-abs(dir.y) * 18.0) * 0.45;
    // Haze is brighter looking towards the sun than away from it (forward
    // scattering), over a very wide angle. This is the only part that reaches
    // the default overview, which looks ~22° or more below the horizon: it
    // warms the far sea at the top of the map, faintly.
    float scatter = pow(max(c, 0.0), 6.0) * 0.14;
    return (corona + band + scatter) * mix(1.0, 0.45, uNight);
  }

  vec3 skyToSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }
  vec3 skyFromSrgb(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  }

  /**
   * The backdrop with the glow on it, in working (linear) space, as it really
   * ends up on screen: Sun3D's glow is blended additively *after* its own sRGB
   * conversion, on top of a backdrop that is already sRGB, so the sum happens
   * in sRGB. Adding the two in linear space instead comes out visibly darker,
   * which is enough to outline the sea's far edge against the sky.
   */
  vec3 skyBehind(vec3 backdrop, vec3 glowColor, vec3 dir) {
    return skyFromSrgb(skyToSrgb(backdrop) + skyToSrgb(glowColor * skyGlow(dir)));
  }
`;
