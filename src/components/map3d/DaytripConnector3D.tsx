import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { WorldPoint } from "../../utils/projection3d";
import { ISLAND_TOP_Y } from "./Island";

const CONNECTOR_LIFT = 0.015;
/** Matches TripMap.tsx's daytrip connector stroke/opacity exactly. */
const CONNECTOR_COLOR = "#8a8072";
const CONNECTOR_OPACITY = 0.5;

interface DaytripConnector3DProps {
  from: WorldPoint;
  to: WorldPoint;
}

/**
 * Thin dashed line from a stop to its daytrip activity. Static, no draw-on
 * animation, matching the 2D map. Uses drei's <Line> rather than a raw JSX
 * <line> + lineDashedMaterial: the bare "line" tag collides with the DOM SVG
 * element in @react-three/fiber's typings (a well-known R3F/TypeScript
 * gotcha), and drei's helper also folds the computeLineDistances() dance
 * dashed lines need into one prop-driven component.
 */
export function DaytripConnector3D({ from, to }: DaytripConnector3DProps) {
  const points = useMemo(
    (): [number, number, number][] => [
      [from.x, ISLAND_TOP_Y + CONNECTOR_LIFT, from.z],
      [to.x, ISLAND_TOP_Y + CONNECTOR_LIFT, to.z],
    ],
    [from.x, from.z, to.x, to.z],
  );

  return (
    <Line points={points} color={CONNECTOR_COLOR} dashed dashSize={0.05} gapSize={0.04} transparent opacity={CONNECTOR_OPACITY} />
  );
}
