import * as THREE from "three";

/**
 * The shape of a single palm frond, shared by the hand-placed hero palms
 * (PalmTree.tsx) and the instanced coastal ones (Vegetation.tsx) so both read as
 * the same species.
 *
 * Replaces the squashed 4-sided cone both used to build a frond from. A cone has
 * one sharp apex and four hard edges running the whole length, which at this
 * scale read as a thorn rather than a leaf: five of them around a trunk gave the
 * crown a spiky, agave-like silhouette. What a coconut frond actually has is a
 * broad blade that starts narrow at the stem, widens past the middle, ends blunt,
 * and arches over before drooping, so that is what is built here: a low-poly
 * ribbon with a raised centre spine, folded like a real leaf so flat shading
 * catches the two halves at different angles.
 *
 * Built as a thin two-sided shell (a top surface plus a copy a hair below it with
 * reversed winding) rather than a single ribbon, because the vegetation material
 * renders front faces only and a one-sided leaf disappears when the camera drops
 * toward the horizon.
 */

/** Segments along the frond's length. Enough for the arch to read as a curve, few enough to stay in the diorama's faceted register. */
const SEGMENTS = 7;

export interface FrondShape {
  /** Reach from the crown to the tip, before the droop shortens it. */
  length: number;
  /** Half the blade's width at its widest point. */
  halfWidth: number;
  /** How far the frond lifts before gravity wins — this is what makes it arch rather than sag straight down. */
  lift: number;
  /** How far below the crown the tip ends up. */
  droop: number;
  /** Height of the centre spine, as a fraction of the local half-width. */
  fold: number;
  /** Shell thickness. Only ever seen edge-on, so a sliver is enough. */
  thickness: number;
}

/**
 * Tuned down from a first version that was correct in shape but too loud: at
 * length 0.26 and half-width 0.052 the crowns were wider than the trunk is tall
 * and the coastal fringe turned into a green mass. Shorter and noticeably
 * narrower, with a little more droop so the extra tuck-in reads as weight rather
 * than as a smaller plant.
 */
export const FROND_SHAPE: FrondShape = {
  length: 0.2,
  halfWidth: 0.034,
  lift: 0.04,
  droop: 0.13,
  fold: 0.45,
  thickness: 0.0035,
};

/**
 * Blade outline. Sampling a sine between 0.12π and 0.92π rather than across the
 * full 0..π gives a stem end and a tip end that both have real width instead of
 * tapering to points — the widest part sits just past halfway, as on the real leaf.
 */
function widthAt(t: number, halfWidth: number): number {
  return halfWidth * Math.sin(Math.PI * (0.12 + 0.8 * t));
}

/** Arch then droop: rises briefly out of the crown, then falls away to `droop` below it at the tip. */
function heightAt(t: number, lift: number, droop: number): number {
  return lift * t - (lift + droop) * t * t;
}

/** One frond, lying along +Z with its stem at the origin, ready to be rotated into a compass direction. */
export function buildFrondGeometry(shape: FrondShape = FROND_SHAPE): THREE.BufferGeometry {
  const { length, halfWidth, lift, droop, fold, thickness } = shape;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Three vertices per row — left edge, raised spine, right edge.
  for (const yShift of [0, -thickness]) {
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const z = length * t;
      const w = widthAt(t, halfWidth);
      const y = heightAt(t, lift, droop) + yShift;
      positions.push(-w, y, z, 0, y + fold * w, z, w, y, z);
      uvs.push(0, t, 0.5, t, 1, t);
    }
  }

  const bottom = (SEGMENTS + 1) * 3;
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    // Left half, then right half. Wound so the top shell faces up.
    const quads = [
      [a, b, b + 1, a + 1],
      [a + 1, b + 1, b + 2, a + 2],
    ];
    for (const [p0, p1, p2, p3] of quads) {
      indices.push(p0, p1, p2, p0, p2, p3);
      // Same quads underneath, reversed, so the frond is opaque from below too.
      indices.push(bottom + p0, bottom + p2, bottom + p1, bottom + p0, bottom + p3, bottom + p2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
