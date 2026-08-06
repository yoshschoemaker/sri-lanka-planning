import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { TransportModeKey } from "../../types/trip";
import type { WorldPoint } from "../../utils/projection3d";
import { buildRouteCurve } from "./RouteLine3D";

/** A fixed approximation of CameraRig's own flyTo transition time — not exact, but close enough that the vehicle and the camera visibly arrive together. */
const TRAVEL_DURATION = 1.4;

const CAR_BODY = "#c2683f";
const CAR_ROOF = "#9c5030";
const TUKTUK_BODY = "#cf7411";
const TUKTUK_ROOF = "#e3a67e";
// Same blue as Train3D's own carriages, so the two read as the same train.
const TRAIN_BODY = "#3a5fa0";
const TRAIN_ROOF = "#2c4a82";

interface RoadVehicle3DProps {
  from: WorldPoint;
  to: WorldPoint;
  kind: TransportModeKey;
}

/**
 * A single low-poly vehicle that drives once from `from` to `to` along the
 * same bezier RouteLine3D draws for that segment, for the tour's transit
 * moments ("tijdens de reis tussen A en B het voertuig zien bewegen"). Unlike
 * Train3D's continuous back-and-forth shuttle, this is a one-shot trip:
 * TripMap3D mounts it only while a tour is actively transiting that leg and
 * unmounts it again shortly after, rather than looping forever.
 */
export function RoadVehicle3D({ from, to, kind }: RoadVehicle3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);

  const curve = useMemo(() => buildRouteCurve(from, to), [from.x, from.z, to.x, to.z]);

  useFrame(({ clock }) => {
    if (startRef.current === null) startRef.current = clock.elapsedTime;
    const u = THREE.MathUtils.clamp((clock.elapsedTime - startRef.current) / TRAVEL_DURATION, 0, 1);
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    const group = groupRef.current;
    if (!group) return;
    // Clears the route tube's own 0.028 radius, same as Train3D.
    group.position.set(point.x, point.y + 0.035, point.z);
    group.rotation.y = Math.atan2(tangent.x, tangent.z);
  });

  const bodyColor = kind === "car" ? CAR_BODY : kind === "train" ? TRAIN_BODY : TUKTUK_BODY;
  const roofColor = kind === "car" ? CAR_ROOF : kind === "train" ? TRAIN_ROOF : TUKTUK_ROOF;
  const bodyLength = kind === "car" ? 0.17 : kind === "train" ? 0.2 : 0.11;
  const bodyHeight = kind === "car" ? 0.065 : kind === "train" ? 0.1 : 0.09;

  return (
    <group ref={groupRef}>
      <mesh position={[0, bodyHeight / 2, 0]}>
        <boxGeometry args={[0.09, bodyHeight, bodyLength]} />
        <meshStandardMaterial color={bodyColor} roughness={0.75} flatShading />
      </mesh>
      <mesh position={[0, bodyHeight * 0.95, -bodyLength * 0.08]}>
        <boxGeometry args={[0.08, bodyHeight * 0.65, bodyLength * 0.5]} />
        <meshStandardMaterial color={roofColor} roughness={0.75} flatShading />
      </mesh>
    </group>
  );
}
