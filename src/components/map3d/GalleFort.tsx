import { useMemo } from "react";
import * as THREE from "three";
import { mergeParts } from "../../utils/mergeParts";
import { getTerrainSurfaceY } from "./Highlands";

/**
 * Galle Fort, the walled Dutch harbour town that's Hikkaduwa's daytrip. What
 * makes it recognisable is the shape of the ramparts: a low, thick, angular wall
 * running around a headland, with the white lighthouse on the seaward corner —
 * not the buildings inside, which at diorama scale are a couple of pixels.
 *
 * So this is the wall, as a ring of straight rampart segments (angular, not
 * curved: the real bastions are polygonal, and it matches the island's own
 * laser-cut silhouette), plus the lighthouse and a hint of roofs inside. Merged
 * into one geometry for the wall so the whole circuit costs one draw call.
 */

/** Bastion count around the circuit. Few enough that the corners read as corners. */
const WALL_SEGMENTS = 7;
const WALL_RADIUS = 0.085;
const WALL_HEIGHT = 0.03;
const WALL_THICKNESS = 0.016;

const LIGHTHOUSE_HEIGHT = 0.075;

const WALL_COLOR = "#c9b48f";
const WALL_TOP_COLOR = "#a8926d";
const LIGHTHOUSE_COLOR = "#f7f2e6";
const LIGHTHOUSE_CAP_COLOR = "#9c5030";
const ROOF_COLOR = "#b5563a";

/**
 * The rampart circuit: one box per side, each rotated to face outward and
 * lengthened slightly so neighbouring segments overlap at the corners rather than
 * leaving a gap there.
 */
function buildWallGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const sideLength = 2 * WALL_RADIUS * Math.sin(Math.PI / WALL_SEGMENTS) * 1.18;

  for (let i = 0; i < WALL_SEGMENTS; i++) {
    const angle = (i / WALL_SEGMENTS) * Math.PI * 2;
    const segment = new THREE.BoxGeometry(sideLength, WALL_HEIGHT, WALL_THICKNESS);
    segment.translate(0, WALL_HEIGHT / 2, WALL_RADIUS);
    segment.rotateY(-angle);
    parts.push(segment);
  }

  return mergeParts(parts, "galle fort wall");
}

/** A few roofs inside the walls, hinted rather than modelled: enough to say "town", cheap enough not to matter. */
const ROOF_OFFSETS: [number, number][] = [
  [-0.03, -0.02],
  [0.025, 0.01],
  [-0.005, 0.03],
];

export function GalleFort({ x, z }: { x: number; z: number }) {
  const wallGeometry = useMemo(buildWallGeometry, []);
  const baseY = useMemo(() => getTerrainSurfaceY(x, z), [x, z]);

  return (
    <group position={[x, baseY, z]}>
      <mesh geometry={wallGeometry}>
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} flatShading />
      </mesh>

      {/* The green inside the walls, which on the real fort is the grassed
          ramparts and the cricket ground. Also hides the ground showing through
          the wall ring at grazing camera angles. */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[WALL_RADIUS - WALL_THICKNESS / 2, WALL_SEGMENTS]} />
        <meshStandardMaterial color={WALL_TOP_COLOR} roughness={0.95} flatShading />
      </mesh>

      {ROOF_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.012, dz]} rotation={[0, i * 0.7, 0]}>
          <coneGeometry args={[0.018, 0.016, 4]} />
          <meshStandardMaterial color={ROOF_COLOR} roughness={0.85} flatShading />
        </mesh>
      ))}

      {/* The lighthouse, on the seaward (south) corner where the real one stands. */}
      <group position={[0.02, 0, WALL_RADIUS * 0.72]}>
        <mesh position={[0, LIGHTHOUSE_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[0.008, 0.012, LIGHTHOUSE_HEIGHT, 6]} />
          <meshStandardMaterial color={LIGHTHOUSE_COLOR} roughness={0.8} flatShading />
        </mesh>
        <mesh position={[0, LIGHTHOUSE_HEIGHT + 0.007, 0]}>
          <coneGeometry args={[0.012, 0.016, 6]} />
          <meshStandardMaterial color={LIGHTHOUSE_CAP_COLOR} roughness={0.7} flatShading />
        </mesh>
      </group>
    </group>
  );
}
