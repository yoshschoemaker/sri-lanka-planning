import { useMemo } from "react";
import * as THREE from "three";
import { mergeParts } from "../../utils/mergeParts";
import type { MapScatter } from "../../utils/useMapScatter";
import { ScatteredInstances } from "./ScatteredInstances";

/**
 * The island's procedural greenery: light woodland in the wet southwest, thorn
 * scrub across the dry north and east, coconut palms along the coastal fringe,
 * tea on the mid slopes and montane grass on the tops. Which species lands where
 * is decided by src/data/habitats.ts against real climate and elevation, not
 * chosen here — this file only knows how each one is shaped and coloured.
 *
 * Every species is one InstancedMesh (see ScatteredInstances.tsx), so all of this
 * costs five draw calls in total. Multi-part models are merged into a single
 * geometry first, since an instanced mesh renders exactly one geometry: a palm's
 * trunk and its four fronds have to become one buffer, or the palm would need a
 * draw call per part and the whole point would be lost.
 *
 * Palette continues the hexes already in the scene rather than introducing new
 * ones: the greens are PalmTree.tsx's and TeaBushes.tsx's, and the dry-zone olive
 * is pulled from Highlands.tsx's own upper-tier terrain color so scrub sits
 * against the dry terrain instead of standing out from it.
 */

// PalmTree.tsx's own two frond greens are #2f5d4e and #3d7462, alternated per
// frond so a single palm is two-tone. Instancing tints a whole palm at once
// instead, and at that granularity the darker of the two read as near-black
// against the sand, so the range is shifted a step lighter.
const FROND_GREEN_DARK = new THREE.Color("#3d7462");
const FROND_GREEN = new THREE.Color("#4f9276");
const LEAF_GREEN = new THREE.Color("#4a8a70");
const LEAF_GREEN_BRIGHT = new THREE.Color("#5c9d78");
const DRY_OLIVE = new THREE.Color("#8f9478");
const DRY_KHAKI = new THREE.Color("#a89f74");
const TEA_GREEN = new THREE.Color("#3d7462");
const TEA_GREEN_LIGHT = new THREE.Color("#5a9b7c");
// Horton Plains patana is tussock grass: greenish, bleaching to straw, never the
// dead brown a first pass produced. Both ends were pulled toward green after the
// straw-heavy version read as dry stubble on the mountain tops.
const PATANA_STRAW = new THREE.Color("#9da571");
const PATANA_GREEN = new THREE.Color("#7f9a63");

/**
 * Per-vertex multiplier that turns a green instance color brown. Three multiplies
 * vertexColor by instanceColor, so tagging just the trunk vertices with this
 * gives a two-tone tree out of one geometry, one material and one draw call —
 * expressed as a ratio rather than an absolute brown precisely so it still lands
 * somewhere woody whatever green the instance happens to be tinted.
 */
const TRUNK_TINT: [number, number, number] = [1.35, 0.72, 0.45];
const UNTINTED: [number, number, number] = [1, 1, 1];

/** Writes a flat per-vertex tint onto a geometry, so merged parts can carry different tints into one buffer. */
function tint(geometry: THREE.BufferGeometry, [r, g, b]: [number, number, number]): THREE.BufferGeometry {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * A broadleaf tree: a squat trunk under a faceted crown. `icosahedronGeometry` at
 * detail 0 is a 20-face solid, which flat-shaded reads as exactly the kind of
 * hand-cut lump the rest of the diorama is made of — and is far cheaper per
 * instance than a sphere at enough segments to look deliberate.
 *
 * Sized against the hand-placed PalmTree's ~0.32-unit trunk so the procedural
 * woodland and the hero palms look like the same forest.
 */
function buildTreeGeometry(): THREE.BufferGeometry {
  const trunkHeight = 0.11;
  const trunk = new THREE.CylinderGeometry(0.012, 0.019, trunkHeight, 5);
  trunk.translate(0, trunkHeight / 2, 0);

  const crown = new THREE.IcosahedronGeometry(0.075, 0);
  // Squashed and lifted onto the trunk: a perfect sphere on a stick reads as a
  // lollipop, a flattened one as a canopy.
  crown.scale(1, 0.85, 1);
  crown.translate(0, trunkHeight + 0.055, 0);

  return mergeParts([tint(trunk, TRUNK_TINT), tint(crown, UNTINTED)], "tree");
}

/** Dry-zone thorn scrub: one low, wide, flattened lump. No trunk — that's what makes it read as bush rather than tree. */
function buildScrubGeometry(): THREE.BufferGeometry {
  const bush = new THREE.IcosahedronGeometry(0.055, 0);
  bush.scale(1.15, 0.6, 1.15);
  bush.translate(0, 0.028, 0);
  return bush;
}

/**
 * A coconut palm, baked from exactly the same primitives and transforms
 * PalmTree.tsx builds its hand-placed hero palms from (minus the coconuts and the
 * per-frame sway, neither of which survives being one static buffer).
 *
 * Deliberately a faithful bake rather than a "simplified version". A first pass
 * used a thinner frond without PalmTree's 2.1x stretch along the frond's own
 * length, and the result read as a flat spiky asterisk rather than a palm: it's
 * the broad drooping leaf, not the radial arrangement, that makes the silhouette.
 *
 * An InstancedMesh has no group hierarchy, so PalmTree's nested
 * <group rotation> / <mesh position rotation scale> structure has to be applied
 * to the geometry directly — in the same order three would (scale, rotate,
 * translate, then the parent groups outward).
 */
const PALM_TRUNK_HEIGHT = 0.32;
const PALM_FROND_COUNT = 5;

function buildPalmGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.014, 0.024, PALM_TRUNK_HEIGHT, 5);
  trunk.translate(0, PALM_TRUNK_HEIGHT / 2, 0);
  // PalmTree leans its trunk slightly; baked in here as a lean about Z.
  trunk.rotateZ(0.12);
  const parts = [tint(trunk, TRUNK_TINT)];

  for (let i = 0; i < PALM_FROND_COUNT; i++) {
    const frond = new THREE.ConeGeometry(0.065, 0.24, 4);
    // Squashed across the leaf and stretched along it, which is what turns a cone
    // into a frond, then tipped over so it droops outward from the crown.
    frond.scale(0.55, 1, 2.1);
    frond.rotateX(Math.PI / 2.4);
    frond.translate(0, 0.01, 0.07);
    // The compass direction this frond points in...
    frond.rotateY((i / PALM_FROND_COUNT) * Math.PI * 2);
    // ...then the crown's own offset on top of the trunk.
    frond.translate(0.02, PALM_TRUNK_HEIGHT, 0);
    parts.push(tint(frond, UNTINTED));
  }

  return mergeParts(parts, "palm");
}

/** A tea bush: the same small sphere TeaBushes.tsx uses, kept identical so the estate rows and the scattered bushes match. */
function buildTeaGeometry(): THREE.BufferGeometry {
  const bush = new THREE.SphereGeometry(0.026, 6, 5);
  bush.translate(0, 0.018, 0);
  return bush;
}

/**
 * A patana grass tuft: a squat 4-sided cone. Cheapest possible geometry, and at
 * this scale a cone is all a tuft of grass needs to be — but wider and shorter
 * than the first attempt, which was tall and thin enough to read as dead twigs
 * rather than as grass.
 */
function buildGrassGeometry(): THREE.BufferGeometry {
  const tuft = new THREE.ConeGeometry(0.023, 0.042, 4);
  tuft.translate(0, 0.021, 0);
  return tuft;
}

/**
 * How much each species moves in the breeze, as horizontal travel per unit of
 * height (see swayMaterial.ts). Scaled to what the real plant does: a coconut
 * palm's crown visibly swings, a broadleaf canopy leans, grass flicks quickly,
 * and a clipped tea bush barely registers. All of them are held down near the
 * threshold of noticeable on purpose — this is meant to read as the island being
 * alive, not as an animation playing.
 */
const SWAY = {
  tree: { amount: 0.045, speed: 0.5 },
  palm: { amount: 0.075, speed: 0.62 },
  scrub: { amount: 0.05, speed: 0.85 },
  grass: { amount: 0.11, speed: 1.15 },
  tea: { amount: 0.02, speed: 0.9 },
} as const;

export function Vegetation({
  scatter,
  prefersReducedMotion,
}: {
  scatter: MapScatter;
  prefersReducedMotion: boolean;
}) {
  const geometries = useMemo(
    () => ({
      tree: buildTreeGeometry(),
      scrub: buildScrubGeometry(),
      palm: buildPalmGeometry(),
      tea: buildTeaGeometry(),
      grass: buildGrassGeometry(),
    }),
    [],
  );

  return (
    <group>
      <ScatteredInstances
        items={scatter.tree}
        geometry={geometries.tree}
        colorA={LEAF_GREEN}
        colorB={LEAF_GREEN_BRIGHT}
        sway={SWAY.tree.amount}
        swaySpeed={SWAY.tree.speed}
        prefersReducedMotion={prefersReducedMotion}
      />
      <ScatteredInstances
        items={scatter.scrub}
        geometry={geometries.scrub}
        colorA={DRY_OLIVE}
        colorB={DRY_KHAKI}
        maxTilt={0.12}
        sway={SWAY.scrub.amount}
        swaySpeed={SWAY.scrub.speed}
        prefersReducedMotion={prefersReducedMotion}
      />
      <ScatteredInstances
        items={scatter.palm}
        geometry={geometries.palm}
        colorA={FROND_GREEN_DARK}
        colorB={FROND_GREEN}
        maxTilt={0.1}
        sway={SWAY.palm.amount}
        swaySpeed={SWAY.palm.speed}
        prefersReducedMotion={prefersReducedMotion}
      />
      <ScatteredInstances
        items={scatter.tea}
        geometry={geometries.tea}
        colorA={TEA_GREEN}
        colorB={TEA_GREEN_LIGHT}
        sway={SWAY.tea.amount}
        swaySpeed={SWAY.tea.speed}
        prefersReducedMotion={prefersReducedMotion}
      />
      <ScatteredInstances
        items={scatter.grass}
        geometry={geometries.grass}
        colorA={PATANA_STRAW}
        colorB={PATANA_GREEN}
        maxTilt={0.22}
        sway={SWAY.grass.amount}
        swaySpeed={SWAY.grass.speed}
        prefersReducedMotion={prefersReducedMotion}
      />
    </group>
  );
}
