import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ScatterItem } from "../../utils/scatter3d";
import { createSwayMaterial } from "./swayMaterial";

/**
 * Renders one scattered species as a single InstancedMesh: one draw call for
 * however many trees, bushes or boulders it holds.
 *
 * This exists because the rest of the map is built the opposite way — every
 * <mesh> declares its own inline geometry and material, which is fine for a
 * handful of hand-placed props and hopeless for the several hundred objects the
 * vegetation scatter produces. (The example this used to cite, 14 decorative
 * WaveCrests at three meshes each, is gone: the sea shader draws its own foam
 * now, which is what 42 draw calls were buying.)
 * Rain3D.tsx already established instancing as the pattern for "many of the same
 * cheap thing"; this generalises it to static decoration.
 *
 * Three details keep the instances from looking like clones despite sharing one
 * material: per-instance color via setColorAt (three's instanceColor attribute),
 * per-instance rotation/scale from the scatter's own seeded jitter, and a
 * per-instance phase in the sway shader (see swayMaterial.ts).
 */
export interface ScatteredInstancesProps {
  items: ScatterItem[];
  /** Built once by the caller (useMemo) and shared by every instance. */
  geometry: THREE.BufferGeometry;
  /**
   * Two palette ends; each instance lands somewhere between them based on its
   * `variant` draw. Passing the same color twice gives a uniform species.
   */
  colorA: THREE.Color;
  colorB: THREE.Color;
  /** Multiplied onto every instance's own scale, so the geometry can be authored at a convenient size. */
  baseScale?: number;
  /** Lifts instances off the terrace surface, for geometry whose origin isn't at its base. */
  yOffset?: number;
  roughness?: number;
  /**
   * Tilts each instance slightly off vertical, in radians, scaled by its variant.
   * Grass tufts and scrub read as organic with a little lean; a building would not.
   */
  maxTilt?: number;
  /**
   * Horizontal travel per unit of height, for the gusty breeze in swayMaterial.ts.
   * 0 (the default) keeps the species completely static — right for boulders and
   * paddy terraces, which have no business moving.
   */
  sway?: number;
  /** Sway rate. Slower for a heavy canopy, quicker for grass. */
  swaySpeed?: number;
  prefersReducedMotion?: boolean;
}

export function ScatteredInstances({
  items,
  geometry,
  colorA,
  colorB,
  baseScale = 1,
  yOffset = 0,
  roughness = 0.9,
  maxTilt = 0,
  sway = 0,
  swaySpeed = 1,
  prefersReducedMotion = false,
}: ScatteredInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const material = useMemo(
    () =>
      createSwayMaterial({
        amplitude: sway,
        speed: swaySpeed,
        roughness,
        // Only when the geometry actually carries a color attribute. Three
        // multiplies vertex color by instance color, which is how a merged
        // two-part model (Vegetation.tsx's trunk-plus-crown) gets a brown trunk
        // and a green canopy out of a single material and a single draw call.
        vertexColors: geometry.hasAttribute("color"),
      }),
    [sway, swaySpeed, roughness, geometry],
  );

  useEffect(() => () => material.dispose(), [material]);

  // Instance matrices are written once per items/appearance change rather than
  // every frame. The breeze happens in the vertex shader instead (see
  // swayMaterial.ts), precisely so that several hundred plants can move without
  // re-uploading their matrices 60 times a second.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      dummy.position.set(item.x, item.y + yOffset, item.z);
      dummy.rotation.set(0, item.rotationY, 0);
      if (maxTilt > 0) {
        // From the scatter's own seeded draws rather than fresh randoms, so the
        // tilt is as reproducible as the position it belongs to.
        dummy.rotation.x = (item.jitter - 0.5) * 2 * maxTilt;
        dummy.rotation.z = (item.variant - 0.5) * 2 * maxTilt;
      }
      dummy.scale.setScalar(item.scale * baseScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.copy(colorA).lerp(colorB, item.variant));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // The bounding sphere three computes from the base geometry alone ignores
    // where the instances actually are, which would frustum-cull the whole
    // species as soon as the geometry's own origin left the view.
    mesh.computeBoundingSphere();
  }, [items, geometry, colorA, colorB, baseScale, yOffset, maxTilt, dummy, color]);

  useFrame((_state, delta) => {
    // One number per species per frame — the entire per-frame cost of the breeze.
    if (sway === 0 || prefersReducedMotion) return;
    material.userData.sway.uSwayTime.value += delta;
  });

  if (items.length === 0) return null;

  return <instancedMesh ref={meshRef} args={[geometry, material, items.length]} />;
}
