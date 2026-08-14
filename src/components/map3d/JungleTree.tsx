import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { WorldPoint } from "../../utils/projection3d";
import { getTerrainSurfaceY } from "./Highlands";

const TRUNK_COLOR = "#6b4226";
/** A shade warmer than the trunk so the bare limb still reads against it from above. */
const LIMB_COLOR = "#7d5330";
const LEAF_COLOR_A = "#3d7462";
const LEAF_COLOR_B = "#4a8a70";

/** Taller than every other tree on the island, which is the point: these are the emergents the langur lives in, and the monkey needs to read as being *up* in a canopy rather than beside a bush. */
const TRUNK_HEIGHT = 0.36;
const CROWN_Y = TRUNK_HEIGHT + 0.04;

/**
 * Height of the bare horizontal limb, above the tree's own ground point. Lower
 * than the crown on purpose: the foliage sits above it, so the monkey hangs and
 * flies through open air under the canopy instead of clipping through leaves.
 */
const LIMB_BASE_Y = 0.3;
/** How much the limb height varies between trees. Enough that the monkey climbs and drops through the grove rather than crossing a level bar. */
const LIMB_LIFT_RANGE = 0.04;
const LIMB_HALF_LENGTH = 0.1;

/** Deterministic 0..1 from a world position — the per-tree variation has to come out the same in the tree and in getLimbAnchor, so Math.random is not an option here. */
function hash01(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Where this tree's swing limb sits, relative to its own ground point. */
export function getLimbHeight(x: number, z: number): number {
  return LIMB_BASE_Y + hash01(x, z) * LIMB_LIFT_RANGE;
}

/** World position of the point Monkey.tsx hangs from — the middle of the limb. */
export function getLimbAnchor(p: WorldPoint): { x: number; y: number; z: number } {
  return { x: p.x, y: getTerrainSurfaceY(p.x, p.z) + getLimbHeight(p.x, p.z), z: p.z };
}

/**
 * Which way each tree in a row should turn its limb: along the row, so the
 * monkey always has branch under it both where it came from and where it is
 * going. The ends take their neighbour's direction; the trees in between split
 * the difference between their two neighbours, which is what makes a bowed row
 * turn gradually instead of kinking at every trunk.
 */
export function getRowHeadings(row: WorldPoint[]): number[] {
  return row.map((_, i) => {
    const before = row[Math.max(0, i - 1)];
    const after = row[Math.min(row.length - 1, i + 1)];
    return Math.atan2(after.x - before.x, after.z - before.z);
  });
}

/** Kept tiny, like PalmTree's — a breeze, not a gale. */
const SWAY_AMPLITUDE = 0.03;
const SWAY_SPEED = 0.45;

/**
 * A hero rainforest tree: a straight bole, one long bare limb, and a faceted
 * crown of three lumps above it. Made of the same flat-shaded primitives as the
 * rest of the diorama, and coloured from Vegetation.tsx's own leaf greens and
 * PalmTree.tsx's trunk brown, so a grove of these reads as the tall emergents
 * standing over the procedural woodland rather than as a different forest.
 *
 * It exists for Monkey.tsx: the limb is the thing being swung from, which is
 * why it's a modelled part rather than implied by the crown. `heading` turns
 * that limb to run along the row of trees, so the monkey always has branch under
 * it in the direction it's travelling. The crown sways; the limb deliberately
 * does not, since it's the anchor the monkey's whole pendulum hangs off.
 */
export function JungleTree({ x, z, heading }: { x: number; z: number; heading: number }) {
  const crownRef = useRef<THREE.Group>(null);
  const baseY = useMemo(() => getTerrainSurfaceY(x, z), [x, z]);
  const limbY = useMemo(() => getLimbHeight(x, z), [x, z]);
  // Same hash as the limb height, offset, so two trees never sway in lockstep.
  const phase = useMemo(() => hash01(z, x) * Math.PI * 2, [x, z]);

  useFrame(({ clock }) => {
    const crown = crownRef.current;
    if (!crown) return;
    const t = clock.elapsedTime * SWAY_SPEED + phase;
    crown.rotation.x = Math.sin(t) * SWAY_AMPLITUDE;
    crown.rotation.z = Math.sin(t * 0.8) * SWAY_AMPLITUDE;
  });

  return (
    <group position={[x, baseY, z]} rotation={[0, heading, 0]}>
      <mesh position={[0, TRUNK_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.016, 0.03, TRUNK_HEIGHT, 6]} />
        <meshStandardMaterial color={TRUNK_COLOR} roughness={0.95} flatShading />
      </mesh>

      {/* The swing limb: runs along local +/-z, i.e. along the row, so both the
          arrival and the departure side have branch to hang from. */}
      <mesh position={[0, limbY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, LIMB_HALF_LENGTH * 2, 5]} />
        <meshStandardMaterial color={LIMB_COLOR} roughness={0.95} flatShading />
      </mesh>

      {/* A second, shorter limb across the row, purely so the tree doesn't read as a T from above. */}
      <mesh position={[0, limbY + 0.045, 0]} rotation={[0, 0, Math.PI / 2 + 0.25]}>
        <cylinderGeometry args={[0.005, 0.005, LIMB_HALF_LENGTH * 1.1, 5]} />
        <meshStandardMaterial color={LIMB_COLOR} roughness={0.95} flatShading />
      </mesh>

      <group ref={crownRef} position={[0, CROWN_Y, 0]}>
        <mesh scale={[1, 0.72, 1]}>
          <icosahedronGeometry args={[0.072, 0]} />
          <meshStandardMaterial color={LEAF_COLOR_B} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0.048, -0.026, 0.022]} scale={[1, 0.75, 1]}>
          <icosahedronGeometry args={[0.044, 0]} />
          <meshStandardMaterial color={LEAF_COLOR_A} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[-0.042, -0.024, -0.028]} scale={[1, 0.75, 1]}>
          <icosahedronGeometry args={[0.04, 0]} />
          <meshStandardMaterial color={LEAF_COLOR_A} roughness={0.9} flatShading />
        </mesh>
      </group>
    </group>
  );
}
