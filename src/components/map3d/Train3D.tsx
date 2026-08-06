import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { WorldPoint } from "../../utils/projection3d";
import { buildRouteCurve } from "./RouteLine3D";

// The Kandy → Ella line is Sri Lanka's famous scenic train (the same blue
// carriages as the hero photo's Nine Arches Bridge shot), hence the color.
const BODY_COLOR = "#3a5fa0";
const BODY_COLOR_DARK = "#2c4a82";
const WINDOW_COLOR = "#eaf6f7";

/** World-unit gap between the locomotive and each trailing carriage. */
const CAR_SPACING = 0.26;
/** World units per second — slow and scenic, not a toy racing by. */
const TRAIN_SPEED = 0.14;
/**
 * Reverses short of the actual endpoints so the train never sits parked
 * directly under a stop marker's pin/label — it shuttles the visible
 * middle stretch of the line, not the last few meters into each station.
 */
const U_MIN = 0.08;
const U_MAX = 0.86;

interface CarSpec {
  /** How far this car trails the locomotive, as a fraction of the spacing above (0 = the locomotive itself). */
  order: number;
  length: number;
  height: number;
}

// Sized well past real train proportions — same "blown up so it reads at
// diorama viewing distance" treatment as PalmTree/Elephant, just pushed
// further since a thin line-hugging shape reads far smaller than a blob.
const CARS: CarSpec[] = [
  { order: 0, length: 0.22, height: 0.11 }, // locomotive, slightly taller
  { order: 1, length: 0.19, height: 0.088 },
  { order: 2, length: 0.19, height: 0.088 },
];

/**
 * Purely decorative: a small train shuttling back and forth along whichever
 * route segment has transportTo.mode === "train" (today, Kandy → Ella —
 * Sri Lanka's most scenic railway, and the same stretch the hero photo's
 * bridge sits on). Rides the exact same bezier curve RouteLine3D draws for
 * that segment, so it never drifts off the line.
 */
export function Train3D({ from, to }: { from: WorldPoint; to: WorldPoint }) {
  const carRefs = useRef<(THREE.Group | null)[]>([]);
  const progress = useRef((U_MIN + U_MAX) / 2);
  const direction = useRef(1);

  const { curve, length } = useMemo(() => {
    const curve = buildRouteCurve(from, to);
    return { curve, length: curve.getLength() };
  }, [from.x, from.z, to.x, to.z]);

  useFrame((_state, delta) => {
    const speedU = TRAIN_SPEED / Math.max(length, 0.001);
    progress.current += direction.current * speedU * delta;
    if (progress.current >= U_MAX) {
      progress.current = U_MAX;
      direction.current = -1;
    } else if (progress.current <= U_MIN) {
      progress.current = U_MIN;
      direction.current = 1;
    }

    const spacingU = CAR_SPACING / Math.max(length, 0.001);

    for (let i = 0; i < CARS.length; i++) {
      const group = carRefs.current[i];
      if (!group) continue;

      const u = THREE.MathUtils.clamp(progress.current - CARS[i].order * spacingU * direction.current, U_MIN, U_MAX);
      const point = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).multiplyScalar(direction.current);

      // Clears the route tube's own 0.028 radius so the train rides on top of it, not through it.
      group.position.set(point.x, point.y + 0.045, point.z);
      group.rotation.y = Math.atan2(tangent.x, tangent.z);
    }
  });

  return (
    <group>
      {CARS.map((car, i) => (
        <group
          key={i}
          ref={(g) => {
            carRefs.current[i] = g;
          }}
        >
          <mesh position={[0, car.height / 2, 0]}>
            <boxGeometry args={[0.13, car.height, car.length]} />
            <meshStandardMaterial color={i === 0 ? BODY_COLOR_DARK : BODY_COLOR} roughness={0.85} flatShading />
          </mesh>
          <mesh position={[0, car.height * 0.62, 0]}>
            <boxGeometry args={[0.14, car.height * 0.28, car.length * 0.78]} />
            <meshStandardMaterial color={WINDOW_COLOR} roughness={0.6} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
