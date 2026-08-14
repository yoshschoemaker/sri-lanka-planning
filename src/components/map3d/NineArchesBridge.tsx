import { useMemo } from "react";
import * as THREE from "three";
import { mergeParts } from "../../utils/mergeParts";
import { getTerrainSurfaceY } from "./Highlands";

/**
 * The Nine Arches Bridge on the Demodara loop below Ella: the colonial-era stone
 * viaduct the Kandy–Ella train ride crosses, and the one built thing on this trip
 * that people photograph more than the temples.
 *
 * Nine arches is not decoration — it's the name and the whole silhouette, so the
 * count is literal. All nine spans plus the deck are merged into a single
 * geometry, which turns what would be ~28 separate meshes into one draw call. The
 * rest of the scene builds props from stacked JSX primitives (Temple.tsx,
 * SigiriyaRock.tsx), which is fine at three or four meshes and wasteful at
 * twenty-eight.
 */

const ARCH_COUNT = 9;
/** Span of one arch, so the whole viaduct is ARCH_COUNT of these wide. */
const ARCH_SPAN = 0.045;
const PIER_WIDTH = 0.014;
/** Height from the ground to the springing line of the arches. */
const PIER_HEIGHT = 0.09;
/** Rise of the arch above the piers. */
const ARCH_RISE = 0.026;
const DECK_HEIGHT = 0.014;
const DEPTH = 0.03;

// A cool grey rather than the warm stone tan this started as: the viaduct sits on
// tan highland terrain, and at first render the two colours were close enough that
// nine arches read as one pale smudge. Same lesson SigiriyaRock.tsx records about
// its own colour.
const STONE_COLOR = "#cfcabe";
const STONE_SHADOW = "#8a8377";

const TOTAL_LENGTH = ARCH_COUNT * ARCH_SPAN;

/**
 * One arch's opening, as the solid *around* it: a half-torus for the curve plus
 * the two piers it springs from. Modelling the void directly would need CSG;
 * outlining it with primitives is how the rest of the diorama is built and reads
 * identically at this scale.
 */
function buildSpan(index: number): THREE.BufferGeometry[] {
  const centerX = (index - (ARCH_COUNT - 1) / 2) * ARCH_SPAN;
  const parts: THREE.BufferGeometry[] = [];

  // The arch curve. A torus with arc = PI is already the upper half, lying in the
  // XY plane with its thickness along Z — exactly an arch, no rotation needed.
  // Radius is half a span so its two ends land on the neighbouring piers, then Y
  // is scaled to give the arch its intended rise rather than a perfect semicircle.
  const arch = new THREE.TorusGeometry(ARCH_SPAN / 2, ARCH_RISE / 2.4, 4, 8, Math.PI);
  arch.scale(1, (ARCH_RISE * 2) / ARCH_SPAN, 1);
  arch.translate(centerX, PIER_HEIGHT, 0);
  parts.push(arch);

  // Pier on this span's left edge. The rightmost pier is added once by the
  // caller, so spans don't each contribute a duplicate at the shared edge.
  const pier = new THREE.BoxGeometry(PIER_WIDTH, PIER_HEIGHT, DEPTH);
  pier.translate(centerX - ARCH_SPAN / 2, PIER_HEIGHT / 2, 0);
  parts.push(pier);

  return parts;
}

function buildBridgeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < ARCH_COUNT; i++) parts.push(...buildSpan(i));

  // Closing pier at the far end.
  const lastPier = new THREE.BoxGeometry(PIER_WIDTH, PIER_HEIGHT, DEPTH);
  lastPier.translate(TOTAL_LENGTH / 2, PIER_HEIGHT / 2, 0);
  parts.push(lastPier);

  // The deck the track runs on, overhanging the arches slightly at each end the
  // way the real parapet does.
  const deck = new THREE.BoxGeometry(TOTAL_LENGTH + PIER_WIDTH * 2, DECK_HEIGHT, DEPTH * 1.15);
  deck.translate(0, PIER_HEIGHT + ARCH_RISE + DECK_HEIGHT / 2, 0);
  parts.push(deck);

  return mergeParts(parts, "nine arches");
}

export function NineArchesBridge({ x, z, rotation }: { x: number; z: number; rotation: number }) {
  const geometry = useMemo(buildBridgeGeometry, []);

  // Anchored on the *lowest* ground under the viaduct's span rather than the
  // ground at its centre: a bridge whose feet float above the valley it crosses
  // is precisely the thing a bridge cannot do. Sampling both ends and taking the
  // minimum puts the piers on the valley floor and lets the deck ride level
  // across it.
  const baseY = useMemo(() => {
    const dx = Math.cos(rotation) * (TOTAL_LENGTH / 2);
    const dz = -Math.sin(rotation) * (TOTAL_LENGTH / 2);
    return Math.min(
      getTerrainSurfaceY(x - dx, z - dz),
      getTerrainSurfaceY(x, z),
      getTerrainSurfaceY(x + dx, z + dz),
    );
  }, [x, z, rotation]);

  return (
    <group position={[x, baseY, z]} rotation={[0, rotation, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={STONE_COLOR} roughness={0.9} flatShading />
      </mesh>
      {/* A darker sliver under the deck, so the arches read against the valley
          behind them instead of flattening into one pale band at this scale. */}
      <mesh position={[0, PIER_HEIGHT + ARCH_RISE - 0.002, 0]}>
        <boxGeometry args={[TOTAL_LENGTH, 0.005, DEPTH * 1.2]} />
        <meshStandardMaterial color={STONE_SHADOW} roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}
