import { WAVE_AMPLITUDE } from "./seaLevel";

/**
 * The sea's wave spectrum, and the GLSL that evaluates it.
 *
 * The GLSL is *generated from* WAVE_SPECTRUM rather than written out by hand.
 * Water.tsx used to carry two copies of its `height()` — one in the vertex
 * stage to move the geometry, one in the fragment stage to shade it — with a
 * comment admitting they were "kept in sync manually (no shared-chunk plumbing
 * between the two shader strings)". Two copies of a wave train is exactly the
 * kind of duplication that drifts silently: the geometry rolls one way while
 * the shading rolls another, and nothing errors. Here the numbers exist once,
 * in TypeScript, and both stages interpolate the same emitted string.
 */

export interface WaveComponent {
  /**
   * Crest-to-crest distance in world units. The island spans 4.9 x 8.7 and the
   * camera sits 11.7-23.3 away, so anything under ~0.4 falls below what the
   * vertex grid can carry (seaGeometry.ts spaces its coastal rings 0.09 apart)
   * and anything over ~4 reads as the whole sea heaving rather than as waves.
   */
  wavelength: number;
  /**
   * Vertical half-height. The *sum* of these is the surface's exact maximum
   * excursion either side of SEA_LEVEL_Y — see the note on SEA_WAVE_AMPLITUDE
   * below for why that is a guarantee and not an estimate.
   */
  amplitude: number;
  /** Unit direction of travel in world (x = east, z = south). North is -z, matching src/utils/projection3d.ts. */
  direction: readonly [number, number];
  /**
   * Gerstner steepness: bunches vertices toward the crest, which sharpens the
   * peak and broadens the trough. Purely horizontal, so it cannot affect
   * SEA_WAVE_AMPLITUDE. Keep sum(steepness * amplitude * k) below 1 or the
   * surface folds through itself and the crests curl inside out; this set sums
   * to 0.51.
   */
  steepness: number;
}

/**
 * Four trains, oriented on Sri Lanka's real swell climate in the same spirit
 * that climateZone3d.ts reconstructs the island's real wet/dry boundary rather
 * than inventing a gradient. The dominant train is Southern Ocean swell
 * arriving from the south-southwest, which is why the south coast is the surf
 * coast; then the southwest monsoon; then a weaker northeast-monsoon train
 * crossing it; then short local wind chop.
 *
 * Crossing trains at these angles are also what stops the sea reading as
 * corrugated iron: a single direction, however well shaped, gives every crest
 * the same length and spacing.
 */
export const WAVE_SPECTRUM: readonly WaveComponent[] = [
  // SSW -> NNE, the long groundswell.
  { wavelength: 3.4, amplitude: 0.05, direction: [0.3827, -0.9239], steepness: 1.4 },
  // SW -> NE, the monsoon swell.
  { wavelength: 2.05, amplitude: 0.033, direction: [0.7218, -0.6921], steepness: 1.4 },
  // ENE -> WSW, crossing the other two so crest lengths vary.
  { wavelength: 1.1, amplitude: 0.0195, direction: [-0.829, 0.5592], steepness: 1.2 },
  // Local chop, near-westerly. Small enough to read as texture rather than as a wave.
  { wavelength: 0.58, amplitude: 0.01, direction: [0.95, 0.3122], steepness: 1.0 },
];

/**
 * Stands in for g in the deep-water dispersion relation w = sqrt(g*k), which is
 * what makes long waves outrun short ones instead of every train sliding at one
 * arbitrary speed. The old shader gave each of its three sines a hand-picked
 * time factor, so the swell and the chop moved at unrelated speeds and the
 * whole field read as scrolling rather than propagating.
 *
 * Tuned rather than physical: one world unit is ~51 km here (WORLD_SCALE
 * 0.014), so a real ocean wave would be 0.002 units long. The sea is
 * necessarily perceptually scaled and its speed with it. 0.55 puts the
 * dominant train at ~0.55 units/s.
 */
export const SEA_WAVE_GRAVITY = 0.55;

/**
 * The sea surface's exact maximum excursion either side of SEA_LEVEL_Y.
 *
 * This is a guarantee, not an estimate, and the reason is worth stating because
 * Island.tsx's whole beach hangs off it: a Gerstner wave's steepness term
 * displaces vertices *horizontally* only. The vertical term is `amplitude *
 * sin(phase)` with no steepness in it, and nothing in OCEAN_SURFACE_GLSL scales
 * amplitude by position, refraction or depth. So the surface can never reach
 * higher than the sum of the amplitudes, whatever else the shader does to it.
 *
 * seaLevel.ts derives WATER_CREST_Y / WATER_TROUGH_Y from its own
 * WAVE_AMPLITUDE, and Island.tsx derives ISLAND_BEACH_Y and ISLAND_BOTTOM_Y
 * from those. The assert below is the seam between the two: this spectrum was
 * chosen to sum to exactly the value seaLevel.ts already publishes, so
 * replacing the old three-sine field is numerically a no-op for the beach and
 * the sand needs no repaint. Retune the amplitudes freely — but if the sum
 * moves, seaLevel.ts's WAVE_AMPLITUDE has to move with it, and the assert will
 * say so rather than letting the waterline quietly drift up the sand.
 */
export const SEA_WAVE_AMPLITUDE = WAVE_SPECTRUM.reduce((sum, wave) => sum + wave.amplitude, 0);

if (import.meta.env.DEV) {
  console.assert(
    Math.abs(SEA_WAVE_AMPLITUDE - WAVE_AMPLITUDE) < 1e-6,
    `Wave spectrum sums to ${SEA_WAVE_AMPLITUDE} but seaLevel.ts publishes WAVE_AMPLITUDE ${WAVE_AMPLITUDE}. ` +
      "Island.tsx's beach shelf and underside are derived from the latter, so they no longer match the sea.",
  );
  for (const wave of WAVE_SPECTRUM) {
    const length = Math.hypot(wave.direction[0], wave.direction[1]);
    console.assert(Math.abs(length - 1) < 1e-3, `WAVE_SPECTRUM direction is not a unit vector (length ${length})`);
  }
  const fold = WAVE_SPECTRUM.reduce(
    (sum, wave) => sum + (wave.steepness * wave.amplitude * Math.PI * 2) / wave.wavelength,
    0,
  );
  console.assert(fold < 1, `Gerstner steepness sums to ${fold}; above 1 the crests fold through themselves`);
}

const waveCalls = WAVE_SPECTRUM.map((wave) => {
  const k = (Math.PI * 2) / wave.wavelength;
  const omega = Math.sqrt(SEA_WAVE_GRAVITY * k);
  return (
    `  oceanWave(p, t, vec2(${wave.direction[0].toFixed(5)}, ${wave.direction[1].toFixed(5)}), ` +
    `${k.toFixed(5)}, ${omega.toFixed(5)}, ${wave.amplitude.toFixed(5)}, ` +
    `${wave.steepness.toFixed(3)} * steep, shoreDir, refract, acc);`
  );
}).join("\n");

/**
 * Shared by both stages of the sea shader. Interpolate once into the vertex
 * string and once into the fragment string; they then evaluate byte-identical
 * code, so the geometry and the shading can never disagree about where a crest
 * is.
 *
 * `steep` and `refract` are passed in rather than computed here because the
 * vertex stage reads them from a baked attribute and the fragment stage from a
 * texture — same numbers, different plumbing.
 */
export const OCEAN_SURFACE_GLSL = /* glsl */ `
struct OceanAcc {
  /** Added to the flat vertex position: xz from steepness, y from amplitude. */
  vec3 offset;
  /** Exact analytic surface normal of the summed field. */
  vec3 normal;
  /** Vertical displacement alone, normalised to [-1, 1] by the caller against SEA_WAVE_AMPLITUDE. */
  float height;
};

void oceanWave(
  vec2 p, float t, vec2 dir, float k, float omega, float amp, float q,
  vec2 shoreDir, float refract, inout OceanAcc acc
) {
  // Refraction. Real swell turns as it shoals until its crests run parallel to
  // the beach, which is why surf lines follow a coastline instead of crossing
  // it at whatever angle the open ocean sent them. Implemented by subtracting
  // the along-shore component of the travel direction: at refract = 1 the wave
  // runs straight at the shore. Deliberately a projection rather than a mix
  // toward the shore normal, which would flip any train that happens to be
  // heading offshore instead of merely straightening it.
  vec2 along = vec2(-shoreDir.y, shoreDir.x);
  vec2 d = dir - along * dot(dir, along) * refract;
  float dLength = length(d);
  d = dLength > 1e-3 ? d / dLength : dir;

  float phase = k * dot(d, p) - omega * t;
  float s = sin(phase);
  float c = cos(phase);

  // The horizontal term is the whole point of Gerstner over a plain sine: it
  // gathers vertices toward the crest, so the peak sharpens and the trough
  // flattens. Note there is no q on the y term — see SEA_WAVE_AMPLITUDE.
  acc.offset.xz += d * (q * amp * c);
  acc.offset.y += amp * s;
  acc.height += amp * s;

  // Exact analytic normal (GPU Gems 1, ch. 1), from the sin/cos this component
  // already has in hand. The old shader spent four extra full evaluations of
  // its height field on a finite-difference normal, plus four more on a second
  // high-frequency field: this is both cheaper and exact rather than sampled,
  // and being per-pixel it makes the shading independent of vertex density.
  acc.normal.x -= d.x * k * amp * c;
  acc.normal.z -= d.y * k * amp * c;
  acc.normal.y -= q * k * amp * s;
}

/**
 * A hump peaking ~0.4 units offshore, 0 at the waterline and 0 again in deep
 * water. Where shoaling actually pitches a crest forward.
 */
float oceanShoalBump(float shore) {
  float x = clamp(shore / 0.85, 0.0, 1.0);
  return 4.0 * x * (1.0 - x);
}

OceanAcc oceanSurface(vec2 p, float t, float shore, vec2 shoreDir) {
  OceanAcc acc;
  acc.offset = vec3(0.0);
  acc.normal = vec3(0.0, 1.0, 0.0);
  acc.height = 0.0;

  // Steepness envelope, not an amplitude envelope, and the distinction matters.
  //
  // Zero at the waterline because the horizontal Gerstner term displaces by up
  // to 0.15 world units, and sloshing the surface that far across the shoreline
  // would either push water up the sand slab or open a gap at its foot. It
  // rises just offshore instead, where shoaling belongs.
  //
  // The amplitude is deliberately left alone: Island.tsx's SAND_STOPS paints
  // wet sand all the way up to WATER_CREST_Y right against the sand wall, so
  // damping the swell as it approached would leave a permanently dry band
  // exactly where the beach says it should be wet. Real waves are at their
  // biggest at the shore anyway; the "rearing up to break" read comes from the
  // steepness here and the foam in Water.tsx.
  float steep = smoothstep(0.0, 0.30, shore) * (1.0 + 0.75 * oceanShoalBump(shore));

  float refract = 0.85 * (1.0 - smoothstep(0.10, 1.30, shore));

${waveCalls}

  acc.normal = normalize(acc.normal);
  acc.height /= ${SEA_WAVE_AMPLITUDE.toFixed(5)};
  return acc;
}
`;

/**
 * Sampling seaDistanceField.ts's baked texture, plus the two cheap procedural
 * patterns the foam and the seabed need. Fragment stage only — the vertex stage
 * reads the same field from a baked attribute instead.
 */
export const OCEAN_SHORE_GLSL = /* glsl */ `
uniform sampler2D uShore;
/** xy = the field window's origin in world (x, z); zw = 1 / its world size. */
uniform vec4 uShoreWindow;

vec2 oceanShoreUv(vec2 p) {
  return (p - uShoreWindow.xy) * uShoreWindow.zw;
}

/**
 * Hash from Dave Hoskins' hash-without-sine set, rather than the ubiquitous
 * fract(sin(dot(p, k)) * 43758.5453). That one's output depends on the
 * driver's sin() precision at large arguments, which is the same class of
 * problem as the mediump dither Water.tsx already forces highp to avoid — and
 * it fails on exactly the devices that are hardest to test on.
 */
float oceanHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float oceanNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(oceanHash(i), oceanHash(i + vec2(1.0, 0.0)), f.x),
    mix(oceanHash(i + vec2(0.0, 1.0)), oceanHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

/**
 * Crossed ridges standing in for sunlight refracted onto the seabed. Four
 * sines, no texture: from the camera's 35-75 degree polar range the caustic
 * pattern is read as bright veining in the shallows rather than as a
 * geometrically correct projection, and this delivers that for the cost of
 * fewer transcendentals than the micro-normal it replaces.
 */
float oceanCaustics(vec2 p, float t) {
  float a = sin(p.x + t * 0.90) + sin(p.y * 1.13 - t * 0.70);
  float b = sin((p.x + p.y) * 0.87 + t * 0.62) + sin((p.x - p.y) * 1.07 - t * 0.48);
  return pow(1.0 - clamp(abs(a * 0.5) * abs(b * 0.5), 0.0, 1.0), 4.0);
}
`;
