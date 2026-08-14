import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ISLAND_TOP_Y } from "./Island";

const BUSH_COLOR_A = new THREE.Color("#3d7462");
const BUSH_COLOR_B = new THREE.Color("#4a8a70");

/** Rows and bushes-per-row of the estate block. Real tea is planted in dense contour rows, which is the whole reason it reads as tea rather than as scattered bushes. */
const ROWS = 7;
const PER_ROW = 9;
/** Spacing along a row, and between rows. Tighter along the row than across it, exactly as a real plucking field is laid out. */
const ALONG = 0.032;
const BETWEEN = 0.048;
/** Radians the whole block is turned by, so the rows run across the slope rather than along the world axes. */
const BLOCK_ROTATION = 0.38;
/** How far each bush wanders off its grid position, as a fraction of ALONG. Enough to stop the block reading as graph paper, little enough to keep the rows legible. */
const ROW_JITTER = 0.35;

const BUSH_RADIUS = 0.026;

/**
 * The hill country's tea estate, at the centre of the mid-elevation band real tea
 * actually grows on (Highlands.tsx picks that band; TripMap3D passes its centre
 * and top height in).
 *
 * Was five hand-placed spheres, which at this scale read as five dots rather than
 * as a tea field. This is the same bush repeated into contour rows, as one
 * InstancedMesh: ~60 bushes for one draw call, where five separate meshes
 * previously cost five. The wider scattered tea across the rest of the band comes
 * from the procedural pass in Vegetation.tsx; this is the dense showpiece block.
 */
export function TeaBushes({ x, z, baseY }: { x: number; z: number; baseY: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const geometry = useMemo(() => new THREE.SphereGeometry(BUSH_RADIUS, 6, 5), []);
  const count = ROWS * PER_ROW;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const cos = Math.cos(BLOCK_ROTATION);
    const sin = Math.sin(BLOCK_ROTATION);

    for (let row = 0; row < ROWS; row++) {
      for (let i = 0; i < PER_ROW; i++) {
        const index = row * PER_ROW + i;
        // Deterministic pseudo-jitter from the index itself: two irrational
        // multipliers give a pattern that never repeats across the block without
        // needing a PRNG instance or a stored offset table.
        const jx = ((Math.sin(index * 12.9898) * 43758.5453) % 1) * ROW_JITTER;
        const jz = ((Math.sin(index * 78.233) * 12345.6789) % 1) * ROW_JITTER;

        const localX = (i - (PER_ROW - 1) / 2) * ALONG + jx * ALONG;
        const localZ = (row - (ROWS - 1) / 2) * BETWEEN + jz * ALONG;

        dummy.position.set(x + localX * cos - localZ * sin, 0.018, z + localX * sin + localZ * cos);
        // Slight size variation so the rows have texture instead of reading as
        // stamped copies.
        dummy.scale.setScalar(0.85 + Math.abs(jx / ROW_JITTER) * 0.3);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, color.copy(BUSH_COLOR_A).lerp(BUSH_COLOR_B, (row % 2) * 0.6 + jz));
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [x, z, count, dummy, color]);

  return (
    <group position={[0, ISLAND_TOP_Y + baseY, 0]}>
      <instancedMesh ref={meshRef} args={[geometry, undefined, count]}>
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </group>
  );
}
