import { useMemo } from "react";
import { getTerrainSurfaceY } from "./Highlands";

// Deliberately warm rust/red rather than anything in the terrain's own
// olive-brown "cut side wall" family (e.g. Highlands.tsx's #6e5c34) — an
// earlier attempt at a muted brown very nearly matched that color and the
// rock all but disappeared against the hillside behind it.
const ROCK_COLOR = "#a8492e";
const ROCK_COLOR_UPPER = "#c9633f";
const RUIN_COLOR = "#e8dcb8";

const ROCK_HEIGHT = 0.32;
const UPPER_HEIGHT = 0.1;

/**
 * Sigiriya's Lion Rock: a real, named landmark (not a generic decoration
 * like PalmTree/WaveCrest), so it gets its own sheer monolith rather than a
 * hand-wavy bump — the real rock is a ~200m volcanic plug rising abruptly
 * out of flat plains, which is exactly what makes it recognizable. Built
 * from simple stacked/rotated boxes (like Temple.tsx) rather than a custom
 * extruded+vertex-colored shape, which is plenty for a monolith silhouette
 * at this scale and keeps the geometry boring and reliable.
 */
export function SigiriyaRock({ x, z }: { x: number; z: number }) {
  const baseY = useMemo(() => getTerrainSurfaceY(x, z), [x, z]);

  return (
    <group position={[x, baseY, z]}>
      <mesh position={[0, ROCK_HEIGHT / 2, 0]} rotation={[0, 0.35, 0]} scale={[1, 1, 0.75]}>
        <boxGeometry args={[0.16, ROCK_HEIGHT, 0.16]} />
        <meshStandardMaterial color={ROCK_COLOR} roughness={0.9} flatShading />
      </mesh>

      <mesh position={[0.01, ROCK_HEIGHT + UPPER_HEIGHT / 2 - 0.01, -0.005]} rotation={[0, 0.55, 0]} scale={[0.85, 1, 0.7]}>
        <boxGeometry args={[0.13, UPPER_HEIGHT, 0.13]} />
        <meshStandardMaterial color={ROCK_COLOR_UPPER} roughness={0.9} flatShading />
      </mesh>

      <mesh position={[0, ROCK_HEIGHT + UPPER_HEIGHT + 0.008, 0]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.1, 0.016, 0.075]} />
        <meshStandardMaterial color={RUIN_COLOR} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}
