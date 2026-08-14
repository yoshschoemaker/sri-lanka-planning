import { useMemo } from "react";
import * as THREE from "three";
import { mergeParts } from "../../utils/mergeParts";
import type { MapScatter } from "../../utils/useMapScatter";
import { ScatteredInstances } from "./ScatteredInstances";

/**
 * Paddy. The wet zone's lowlands are almost entirely rice, and it's the brightest
 * green on the island — a completely different green from forest canopy, which is
 * exactly why it's worth having: it gives the wet southwest a second colour
 * instead of one flat mass of trees.
 *
 * Each instance is a small block of three stepped terraces rather than a single
 * flat patch, because a paddy field's low retaining bunds and slight level
 * differences are what make it read as cultivated rather than as a green sticker.
 */

const PADDY_GREEN = new THREE.Color("#7cb342");
const PADDY_GREEN_YOUNG = new THREE.Color("#9ccc55");

const TERRACE_COUNT = 3;
const TERRACE_WIDTH = 0.115;
const TERRACE_DEPTH = 0.042;
/** Each terrace steps down by this much, so the block has a visible fall across it. */
const STEP = 0.006;
/** Thin slab rather than a zero-height plane: a flat plane at ground level z-fights, and the edge catches the light as a bund. */
const SLAB_HEIGHT = 0.005;

/**
 * A stepped block of paddy terraces, merged into one geometry so the whole field
 * — and every other field — still costs a single draw call.
 */
function buildPaddyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  for (let i = 0; i < TERRACE_COUNT; i++) {
    // Terraces narrow slightly as they step down, which reads as following a
    // contour instead of stacking rectangles.
    const width = TERRACE_WIDTH * (1 - i * 0.12);
    const slab = new THREE.BoxGeometry(width, SLAB_HEIGHT, TERRACE_DEPTH);
    slab.translate(0, SLAB_HEIGHT / 2 + (TERRACE_COUNT - 1 - i) * STEP, (i - (TERRACE_COUNT - 1) / 2) * TERRACE_DEPTH);
    parts.push(slab);
  }

  return mergeParts(parts, "paddy");
}

export function PaddyFields({ scatter }: { scatter: MapScatter }) {
  const geometry = useMemo(buildPaddyGeometry, []);

  return (
    <ScatteredInstances
      items={scatter.paddy}
      geometry={geometry}
      colorA={PADDY_GREEN}
      colorB={PADDY_GREEN_YOUNG}
      roughness={0.85}
    />
  );
}
