import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { WorldPoint } from "../../utils/projection3d";
import { mergeParts } from "../../utils/mergeParts";
import { buildRouteCurve } from "./RouteLine3D";

// The Kandy → Ella line is Sri Lanka's famous scenic train (the same blue
// carriages as the hero photo's Nine Arches Bridge shot), hence the colors:
// deep blue bodies with the railway's yellow waistline stripe and a pale grey
// roof — from the diorama's near-overhead camera the roof is most of what you
// see, so it gets the ribs and vents that keep it from reading as a flat slab.
const BODY_COLOR = "#33589a";
const BODY_COLOR_DARK = "#26426f";
const ROOF_COLOR = "#b3b9c0";
const ROOF_RIB_COLOR = "#9aa1a9";
const TRIM_COLOR = "#e6b34a";
const WINDOW_COLOR = "#cfe8ef";
const METAL_COLOR = "#3a3e45";
const LAMP_COLOR = "#ffe6ab";

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

const CAR_WIDTH = 0.125;
/** Top of the underframe: the floor every body part is stacked from. */
const FLOOR_Y = 0.022;
const WHEEL_RADIUS = 0.016;
const WHEEL_Y = 0.014;
/** Half the axle spacing, as a fraction of car length. */
const AXLE_Z = 0.29;

const materials = {
  shell: new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.72, flatShading: true }),
  shellDark: new THREE.MeshStandardMaterial({ color: BODY_COLOR_DARK, roughness: 0.72, flatShading: true }),
  roof: new THREE.MeshStandardMaterial({ color: ROOF_COLOR, roughness: 0.9, flatShading: true }),
  rib: new THREE.MeshStandardMaterial({ color: ROOF_RIB_COLOR, roughness: 0.95, flatShading: true }),
  trim: new THREE.MeshStandardMaterial({ color: TRIM_COLOR, roughness: 0.55, flatShading: true }),
  glass: new THREE.MeshStandardMaterial({
    color: WINDOW_COLOR,
    roughness: 0.25,
    metalness: 0.15,
    flatShading: true,
  }),
  metal: new THREE.MeshStandardMaterial({ color: METAL_COLOR, roughness: 0.85, flatShading: true }),
  lamp: new THREE.MeshStandardMaterial({
    color: LAMP_COLOR,
    emissive: new THREE.Color(LAMP_COLOR),
    emissiveIntensity: 0.9,
    roughness: 0.4,
  }),
};

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

/**
 * One car, split by colour: each group merges into a single geometry, so a car
 * that is ~20 hand-placed primitives still costs five draw calls plus its two
 * axles (NineArchesBridge.tsx records the same trade-off).
 */
function buildCar(spec: CarSpec, isLoco: boolean) {
  const { length: len, height: h } = spec;
  const bodyTop = FLOOR_Y + h;
  const half = CAR_WIDTH / 2;

  const shell: THREE.BufferGeometry[] = [box(CAR_WIDTH, h, len, 0, FLOOR_Y + h / 2, 0)];
  const roof: THREE.BufferGeometry[] = [
    // Two stacked slabs instead of one: the narrower cap fakes the curve of a
    // real carriage roof at a fraction of a cylinder's triangles.
    box(CAR_WIDTH + 0.006, 0.013, len * 0.99, 0, bodyTop + 0.005, 0),
    box(CAR_WIDTH * 0.7, 0.008, len * 0.96, 0, bodyTop + 0.014, 0),
  ];
  const rib: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [
    // Waistline stripe, a hair wider than the body so it stands proud of it
    // rather than z-fighting with the sides.
    box(CAR_WIDTH + 0.004, 0.007, len * 0.94, 0, FLOOR_Y + h * 0.3, 0),
  ];
  const glass: THREE.BufferGeometry[] = [];
  const frame: THREE.BufferGeometry[] = [
    box(CAR_WIDTH - 0.014, 0.02, len * 0.96, 0, WHEEL_Y - 0.002 + 0.01, 0),
  ];

  // Roof ribs, evenly spaced. These are what make the roof read as a carriage
  // from straight above, where the windows and stripe are barely in view.
  const ribCount = isLoco ? 3 : 4;
  for (let i = 0; i < ribCount; i++) {
    const z = len * (-0.34 + (0.68 * i) / (ribCount - 1));
    rib.push(box(CAR_WIDTH * 0.78, 0.005, len * 0.035, 0, bodyTop + 0.019, z));
  }

  // Window band. One box spanning the full width shows glass on both sides at
  // once — the interior is never visible, so a second row would be wasted.
  const paneCount = isLoco ? 3 : 5;
  const span = len * (isLoco ? 0.5 : 0.78);
  const spanCenter = isLoco ? -len * 0.16 : 0;
  const step = span / paneCount;
  for (let i = 0; i < paneCount; i++) {
    const z = spanCenter - span / 2 + step * (i + 0.5);
    glass.push(box(CAR_WIDTH + 0.005, h * 0.32, step * 0.66, 0, FLOOR_Y + h * 0.66, z));
  }

  // Couplings, so the gap between cars reads as connected rolling stock rather
  // than three boxes floating in convoy.
  for (const end of [-1, 1] as const) {
    frame.push(box(0.026, 0.014, 0.016, 0, FLOOR_Y - 0.004, end * (len / 2 + 0.006)));
  }

  if (isLoco) {
    const nose = len / 2;
    // Sloped snout: a short lower block ahead of the cab plus the cab's own
    // slanted windscreen above it.
    shell.push(box(CAR_WIDTH - 0.012, h * 0.6, 0.03, 0, FLOOR_Y + h * 0.3, nose + 0.014));
    const windscreen = new THREE.BoxGeometry(CAR_WIDTH - 0.02, h * 0.34, 0.012);
    windscreen.rotateX(-0.5);
    windscreen.translate(0, FLOOR_Y + h * 0.7, nose - 0.012);
    glass.push(windscreen);
    // Headlights on the nose face, and the exhaust stack on the cab roof.
    for (const side of [-1, 1] as const) {
      frame.push(box(0.014, 0.011, 0.006, side * 0.032, FLOOR_Y + h * 0.42, nose + 0.031));
    }
    rib.push(box(0.03, 0.012, 0.03, 0, bodyTop + 0.023, -len * 0.28));
    trim.push(box(CAR_WIDTH - 0.01, 0.006, 0.008, 0, FLOOR_Y + h * 0.14, nose + 0.03));
  }

  const lamp: THREE.BufferGeometry[] = isLoco
    ? [-1, 1].map((side) => box(0.01, 0.008, 0.004, side * 0.032, FLOOR_Y + h * 0.42, len / 2 + 0.035))
    : [];

  // One axle = two wheels plus the rod between them, built around the origin so
  // the mesh can simply spin on its x axis.
  const buildAxle = () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1] as const) {
      const wheel = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.011, 9);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(side * (half - 0.008), 0, 0);
      parts.push(wheel);
    }
    const rod = new THREE.CylinderGeometry(0.004, 0.004, CAR_WIDTH - 0.02, 5);
    rod.rotateZ(Math.PI / 2);
    parts.push(rod);
    return mergeParts(parts, "train axle");
  };

  return {
    shell: mergeParts(shell, "train shell"),
    roof: mergeParts(roof, "train roof"),
    rib: mergeParts(rib, "train roof ribs"),
    trim: mergeParts(trim, "train trim"),
    glass: mergeParts(glass, "train glass"),
    frame: mergeParts(frame, "train frame"),
    lamp: lamp.length ? mergeParts(lamp, "train lamps") : null,
    axle: buildAxle(),
    axleZ: len * AXLE_Z,
  };
}

// Dimensions are constants, so the two variants are built once for the whole
// app rather than per mount — the geometries live as long as the module does.
const LOCO_GEOMETRY = buildCar(CARS[0], true);
const CARRIAGE_GEOMETRY = buildCar(CARS[1], false);

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
      {CARS.map((_car, i) => (
        <group
          key={i}
          ref={(g) => {
            carRefs.current[i] = g;
          }}
        >
          <TrainCar variant={i === 0 ? "loco" : "carriage"} speed={TRAIN_SPEED} />
        </group>
      ))}
    </group>
  );
}

/**
 * One car's meshes, facing +z (its direction of travel), with its wheels
 * rolling at `speed` world units per second. Exported so RoadVehicle3D can put
 * the same locomotive on a train-mode leg instead of its own generic box —
 * the two are the same train, seen at different moments of the tour.
 */
export function TrainCar({ variant, speed }: { variant: "loco" | "carriage"; speed: number }) {
  const axleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const spin = useRef(0);
  const parts = variant === "loco" ? LOCO_GEOMETRY : CARRIAGE_GEOMETRY;

  useFrame((_state, delta) => {
    // The car is always turned to face the way it travels, so locally "forward"
    // is always +z and the wheels roll the same way in both directions.
    spin.current += (speed / WHEEL_RADIUS) * delta;
    for (const axle of axleRefs.current) {
      if (axle) axle.rotation.x = spin.current;
    }
  });

  return (
    <group>
      <mesh geometry={parts.shell} material={variant === "loco" ? materials.shellDark : materials.shell} />
      <mesh geometry={parts.roof} material={materials.roof} />
      <mesh geometry={parts.rib} material={materials.rib} />
      <mesh geometry={parts.trim} material={materials.trim} />
      <mesh geometry={parts.glass} material={materials.glass} />
      <mesh geometry={parts.frame} material={materials.metal} />
      {parts.lamp && <mesh geometry={parts.lamp} material={materials.lamp} />}
      {[-1, 1].map((end, k) => (
        <mesh
          key={end}
          ref={(m) => {
            axleRefs.current[k] = m;
          }}
          geometry={parts.axle}
          material={materials.metal}
          position={[0, WHEEL_Y, end * parts.axleZ]}
        />
      ))}
    </group>
  );
}
