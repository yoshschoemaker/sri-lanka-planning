import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { getTerrainSurfaceY } from "./Highlands";
import "./StillWater";
import type { StillWaterMaterialInstance } from "./StillWater";

/**
 * Ravana Falls, below Ella. One vertical sheet of water with the surface pattern
 * scrolling downward, plus a puff of Sparkles as spray at the base.
 *
 * The height isn't a hardcoded number: the component samples the terrain a short
 * step behind itself (uphill) and a short step in front (downhill) and spans
 * whatever it finds. So if the terrain data or the tier heights ever change, the
 * fall still reaches from the top of the cliff to the bottom instead of hanging
 * in the air or vanishing into rock.
 */

/** How far uphill/downhill to sample for the drop. Roughly one terrain terrace's horizontal extent at this scale. */
const SAMPLE_STEP = 0.16;
/** Width of the falling sheet. */
const WIDTH = 0.075;
/** Never shorter than this, so the fall still reads as a fall even if it lands on a gentler slope than intended. */
const MIN_HEIGHT = 0.08;
/** Sinks the sheet slightly into the cliff top and pushes the base slightly past the foot, so neither end shows a gap against the terrain. */
const OVERLAP = 0.012;
/** Fast enough to read as falling rather than rippling. */
const FALL_FLOW = 0.85;

export function Waterfall({
  x,
  z,
  rotation,
  nightRef,
  prefersReducedMotion,
}: {
  x: number;
  z: number;
  rotation: number;
  nightRef: RefObject<number>;
  prefersReducedMotion: boolean;
}) {
  const materialRef = useRef<StillWaterMaterialInstance>(null);

  const { height, topY } = useMemo(() => {
    // "Downhill" is the direction the fall faces: +z rotated by `rotation`.
    const dx = Math.sin(rotation);
    const dz = Math.cos(rotation);
    const uphillY = getTerrainSurfaceY(x - dx * SAMPLE_STEP, z - dz * SAMPLE_STEP);
    const downhillY = getTerrainSurfaceY(x + dx * SAMPLE_STEP, z + dz * SAMPLE_STEP);
    const measured = uphillY - downhillY;
    return { height: Math.max(measured, MIN_HEIGHT) + OVERLAP * 2, topY: uphillY + OVERLAP };
  }, [x, z, rotation]);

  const geometry = useMemo(() => {
    // Three columns rather than two, so u can encode distance from the sheet's
    // edge (0 at both sides, 1 down the middle) as StillWater's shader expects.
    const geometry = new THREE.PlaneGeometry(WIDTH, height, 2, 1);
    const uv = geometry.attributes.uv;
    const position = geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      // PlaneGeometry's own u runs 0→1 across; fold it so both edges read as bank.
      uv.setX(i, 1 - Math.abs(uv.getX(i) * 2 - 1));
      // v runs down the fall: flipped so the scroll direction is downward.
      uv.setY(i, 1 - (position.getY(i) / height + 0.5));
    }
    uv.needsUpdate = true;
    return geometry;
  }, [height]);

  useFrame((_state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    // Held still under reduced-motion: a scrolling sheet is exactly the kind of
    // continuous movement that setting asks us not to run.
    if (!prefersReducedMotion) material.uTime += delta;
    material.uNight = nightRef.current;
  });

  return (
    <group position={[x, topY - height / 2, z]} rotation={[0, rotation, 0]}>
      <mesh geometry={geometry}>
        {/* Rendered from both sides: the camera can orbit past the cliff, and a
            single-sided sheet would disappear from behind. */}
        <stillWaterMaterial ref={materialRef} precision="highp" uFlow={FALL_FLOW} uRippleScale={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Spray at the foot of the fall. Small and low-count — it's a detail at
          this scale, and Sparkles is already used elsewhere in the scene for the
          sea sheen and the fireflies. */}
      <Sparkles
        count={10}
        scale={[WIDTH * 1.6, 0.05, WIDTH]}
        position={[0, -height / 2 + 0.015, 0.01]}
        size={1.8}
        speed={prefersReducedMotion ? 0 : 0.4}
        opacity={0.7}
        color="#eafcff"
        noise={0.8}
      />
    </group>
  );
}
