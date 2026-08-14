import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Merges hand-built primitive parts into one geometry, so a multi-part prop costs
 * a single draw call (and, for the scattered species, can be instanced at all —
 * an InstancedMesh renders exactly one geometry).
 *
 * Exists as a shared helper because of one trap that is easy to hit and gives a
 * confusing error: three's primitives are not consistently indexed.
 * CylinderGeometry, BoxGeometry, ConeGeometry, TorusGeometry and SphereGeometry
 * are indexed; IcosahedronGeometry (and the other polyhedra) are not. mergeGeometries
 * refuses a mixed set with "make sure index attribute exists among all geometries,
 * or in none of them", so every part is converted to non-indexed here first.
 *
 * Non-indexed is the right direction to normalise in rather than the other way
 * around: everything in this scene is flat-shaded, which needs per-face normals
 * and therefore unshared vertices anyway.
 *
 * Disposes the parts, since they exist only to be merged. Throws rather than
 * returning null: for hand-authored parts a merge failure is a programming error,
 * not a runtime condition to handle.
 */
export function mergeParts(parts: THREE.BufferGeometry[], what: string): THREE.BufferGeometry {
  const flattened = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const merged = mergeGeometries(flattened);

  for (const part of parts) part.dispose();
  // toNonIndexed() returns a new geometry, so those intermediates need disposing too.
  for (let i = 0; i < parts.length; i++) {
    if (flattened[i] !== parts[i]) flattened[i].dispose();
  }

  if (!merged) throw new Error(`${what} geometry merge failed`);
  return merged;
}
