import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { WorldPoint } from "../../utils/projection3d";
import { getTerrainSurfaceY } from "./Highlands";

const CONNECTOR_LIFT = 0.015;
/** Matches TripMap.tsx's daytrip connector stroke/opacity exactly. */
const CONNECTOR_COLOR = "#8a8072";
const CONNECTOR_OPACITY = 0.32;
/** Sub-pixel width: LineMaterial antialiases it into a hairline instead of clamping to 1px. */
const CONNECTOR_WIDTH = 0.7;
/** Dash far shorter than the gap, so it reads as dots rather than dashes. */
const CONNECTOR_DASH = 0.012;
const CONNECTOR_GAP = 0.045;

interface DaytripConnector3DProps {
  from: WorldPoint;
  to: WorldPoint;
}

/**
 * Hairline dotted line from a stop to its daytrip activity. Static, no draw-on
 * animation, matching the 2D map. Uses drei's <Line> rather than a raw JSX
 * <line> + lineDashedMaterial: the bare "line" tag collides with the DOM SVG
 * element in @react-three/fiber's typings (a well-known R3F/TypeScript
 * gotcha), and drei's helper also folds the computeLineDistances() dance
 * dashed lines need into one prop-driven component.
 */
export function DaytripConnector3D({ from, to }: DaytripConnector3DProps) {
  const points = useMemo(
    (): [number, number, number][] => [
      [from.x, getTerrainSurfaceY(from.x, from.z) + CONNECTOR_LIFT, from.z],
      [to.x, getTerrainSurfaceY(to.x, to.z) + CONNECTOR_LIFT, to.z],
    ],
    [from.x, from.z, to.x, to.z],
  );

  return (
    <Line
      points={points}
      color={CONNECTOR_COLOR}
      lineWidth={CONNECTOR_WIDTH}
      dashed
      dashSize={CONNECTOR_DASH}
      gapSize={CONNECTOR_GAP}
      transparent
      opacity={CONNECTOR_OPACITY}
    />
  );
}
