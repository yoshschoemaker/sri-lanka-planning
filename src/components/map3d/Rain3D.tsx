import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ISLAND_TOP_Y } from "./Island";

const RAIN_COUNT = 46;
const RAIN_COLOR = "#aecbdb";
/** Roughly matches the island's own footprint, so drops fall across highlands and coast alike rather than one narrow patch. */
const AREA_RADIUS = 3.2;
const DROP_LENGTH = 0.09;
const FALL_SPEED = 3.4;
/** How far above the island top a drop starts before falling back through the same range once it lands. */
const DROP_CEILING = 3.2;

interface Drop {
  x: number;
  z: number;
  y: number;
  speed: number;
}

/**
 * A light monsoon shower over the diorama, toggled together with TripMap3D's
 * evening lighting (real fireflies/rain both read as "dusk", not "midday").
 * One instancedMesh for all drops keeps this cheap on mobile GPUs — a single
 * draw call regardless of drop count, matching the app's existing care
 * around mobile WebGL cost (see Water.tsx's precision fix).
 */
export function Rain3D({ active, prefersReducedMotion }: { active: boolean; prefersReducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: RAIN_COUNT }, () => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * AREA_RADIUS;
        return {
          x: Math.cos(angle) * r,
          z: Math.sin(angle) * r,
          y: ISLAND_TOP_Y + Math.random() * DROP_CEILING,
          speed: FALL_SPEED * (0.8 + Math.random() * 0.4),
        };
      }),
    [],
  );

  // Mount-only: gives every drop a valid position immediately, so there's no
  // single-frame flash of all instances sitting stacked at the origin before
  // the first useFrame tick below ever runs.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < drops.length; i++) {
      dummy.position.set(drops[i].x, drops[i].y, drops[i].z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !active || prefersReducedMotion) return;
    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];
      drop.y -= drop.speed * delta;
      if (drop.y < ISLAND_TOP_Y) drop.y = ISLAND_TOP_Y + DROP_CEILING;
      dummy.position.set(drop.x, drop.y, drop.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]} visible={active} frustumCulled={false}>
      <cylinderGeometry args={[0.004, 0.004, DROP_LENGTH, 4]} />
      <meshBasicMaterial color={RAIN_COLOR} transparent opacity={0.5} depthWrite={false} />
    </instancedMesh>
  );
}
