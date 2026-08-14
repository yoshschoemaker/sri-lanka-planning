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
 * count is literal.
 *
 * The whole viaduct wall is one extruded shape with nine holes cut in it, rather
 * than the stacked primitives the rest of the diorama uses (Temple.tsx,
 * SigiriyaRock.tsx). Outlining each opening with a half-torus and two boxes was
 * the earlier approach and it never read as a bridge: seen from the map's camera
 * angle you got a row of thin white posts under a rail, because the thing that
 * makes a viaduct legible is the solid spandrel wall *between* the openings, and
 * an outline has no wall. THREE.Shape holes give the real solid-with-voids
 * silhouette without needing CSG, and still cost a single draw call.
 */

const ARCH_COUNT = 9;
/** Span of one arch, so the whole viaduct is ARCH_COUNT of these wide. */
const ARCH_SPAN = 0.045;
/** Solid left between two openings. The rest of the span is the opening itself. */
const PIER_WIDTH = 0.013;
const OPENING_WIDTH = ARCH_SPAN - PIER_WIDTH;
/** Height of the straight part of a pier, where the arch starts to curve. */
const SPRING_HEIGHT = 0.05;
/** Rise of the arch above the springing line. Half the opening = a semicircle. */
const ARCH_RISE = OPENING_WIDTH / 2;
/** Solid wall carried above the crown of the arches. */
const SPANDREL_HEIGHT = 0.016;
const WALL_TOP = SPRING_HEIGHT + ARCH_RISE + SPANDREL_HEIGHT;
const DECK_HEIGHT = 0.007;
const PARAPET_HEIGHT = 0.009;
const PARAPET_THICKNESS = 0.004;
const DEPTH = 0.032;
/** Lowpoly, but enough segments that the arch curve doesn't read as a triangle. */
const ARCH_SEGMENTS = 7;

// A cool grey rather than the warm stone tan this started as: the viaduct sits on
// tan highland terrain, and at first render the two colours were close enough that
// nine arches read as one pale smudge. Same lesson SigiriyaRock.tsx records about
// its own colour.
const STONE_COLOR = "#cfcabe";
const STONE_SHADOW = "#8a8377";

const TOTAL_LENGTH = ARCH_COUNT * ARCH_SPAN;
/** The wall runs half a pier past the outer arches, so it ends on solid stone. */
const WALL_HALF_LENGTH = TOTAL_LENGTH / 2 + PIER_WIDTH / 2;

function archCenterX(index: number): number {
  return (index - (ARCH_COUNT - 1) / 2) * ARCH_SPAN;
}

/** One opening: straight legs up to the springing line, then a semicircular head. */
function buildOpening(index: number): THREE.Path {
  const centerX = archCenterX(index);
  const half = OPENING_WIDTH / 2;
  const hole = new THREE.Path();

  hole.moveTo(centerX - half, 0);
  hole.lineTo(centerX - half, SPRING_HEIGHT);
  // From the left springing point over the crown to the right one. Going from PI
  // to 0 clockwise is the upper half; the lower half would cut the piers away.
  hole.absarc(centerX, SPRING_HEIGHT, half, Math.PI, 0, true);
  hole.lineTo(centerX + half, 0);
  hole.closePath();

  return hole;
}

function buildBridgeGeometry(): THREE.BufferGeometry {
  const wall = new THREE.Shape();
  wall.moveTo(-WALL_HALF_LENGTH, 0);
  wall.lineTo(WALL_HALF_LENGTH, 0);
  wall.lineTo(WALL_HALF_LENGTH, WALL_TOP);
  wall.lineTo(-WALL_HALF_LENGTH, WALL_TOP);
  wall.closePath();

  for (let i = 0; i < ARCH_COUNT; i++) wall.holes.push(buildOpening(i));

  const wallGeometry = new THREE.ExtrudeGeometry(wall, {
    depth: DEPTH,
    bevelEnabled: false,
    curveSegments: ARCH_SEGMENTS,
  });
  // ExtrudeGeometry builds along +Z from the shape's plane; the prop is placed by
  // its centre, so recentre the extrusion on it.
  wallGeometry.translate(0, 0, -DEPTH / 2);

  const parts: THREE.BufferGeometry[] = [wallGeometry];

  // The deck, overhanging the wall on both sides the way the real cornice does.
  const deck = new THREE.BoxGeometry(WALL_HALF_LENGTH * 2 + PARAPET_THICKNESS, DECK_HEIGHT, DEPTH * 1.2);
  deck.translate(0, WALL_TOP + DECK_HEIGHT / 2, 0);
  parts.push(deck);

  // Parapets along both edges. They carry the silhouette at this scale far more
  // than the arches do — without them the deck is a bare slab.
  const deckTop = WALL_TOP + DECK_HEIGHT;
  for (const side of [-1, 1]) {
    const parapet = new THREE.BoxGeometry(WALL_HALF_LENGTH * 2, PARAPET_HEIGHT, PARAPET_THICKNESS);
    parapet.translate(0, deckTop + PARAPET_HEIGHT / 2, (side * (DEPTH * 1.2 - PARAPET_THICKNESS)) / 2);
    parts.push(parapet);
  }

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
      {/* A darker band under the cornice, so the deck reads as a separate course
          of stone instead of merging into the wall below it. */}
      <mesh position={[0, WALL_TOP - 0.002, 0]}>
        <boxGeometry args={[WALL_HALF_LENGTH * 2, 0.004, DEPTH * 1.06]} />
        <meshStandardMaterial color={STONE_SHADOW} roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}
