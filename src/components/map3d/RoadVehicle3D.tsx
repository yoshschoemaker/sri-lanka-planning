import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { TransportModeKey } from "../../types/trip";
import type { WorldPoint } from "../../utils/projection3d";
import { mergeParts } from "../../utils/mergeParts";
import { buildRouteCurve } from "./RouteLine3D";
import { TrainCar } from "./Train3D";

/** A fixed approximation of CameraRig's own flyTo transition time — not exact, but close enough that the vehicle and the camera visibly arrive together. */
const TRAVEL_DURATION = 1.4;

const CAR_BODY = "#c2683f";
const CAR_ROOF = "#9c5030";
const TUKTUK_BODY = "#cf7411";
const TUKTUK_CANOPY = "#e3a67e";
const GLASS_COLOR = "#cfe8ef";
const TYRE_COLOR = "#33363b";
const CHROME_COLOR = "#8e949c";
const LAMP_COLOR = "#ffe6ab";
const LUGGAGE_COLOR = "#7d6a55";

/** Vehicles face +z, matching the tangent they are turned onto. */
const CAR_WIDTH = 0.084;
const CAR_LENGTH = 0.18;
const CAR_BODY_H = 0.038;
const CAR_WHEEL_R = 0.017;
/** Underside of the body. Above the axle centre, so the wheels show below the sills. */
const CAR_FLOOR = CAR_WHEEL_R + 0.002;
/** Cabin covers most of the length, with a short bonnet ahead of it — a tour van, not a pickup. */
const CAR_CABIN_H = 0.034;
const CAR_CABIN_LENGTH = CAR_LENGTH * 0.62;
const CAR_CABIN_Z = -CAR_LENGTH * 0.13;

const TUK_WIDTH = 0.072;
const TUK_LENGTH = 0.115;
const TUK_BODY_H = 0.05;
const TUK_WHEEL_R = 0.014;
const TUK_FLOOR = TUK_WHEEL_R + 0.001;

const materials = {
  car: new THREE.MeshStandardMaterial({ color: CAR_BODY, roughness: 0.6, flatShading: true }),
  carRoof: new THREE.MeshStandardMaterial({ color: CAR_ROOF, roughness: 0.65, flatShading: true }),
  tuktuk: new THREE.MeshStandardMaterial({ color: TUKTUK_BODY, roughness: 0.6, flatShading: true }),
  tuktukCanopy: new THREE.MeshStandardMaterial({ color: TUKTUK_CANOPY, roughness: 0.75, flatShading: true }),
  glass: new THREE.MeshStandardMaterial({ color: GLASS_COLOR, roughness: 0.25, metalness: 0.15, flatShading: true }),
  tyre: new THREE.MeshStandardMaterial({ color: TYRE_COLOR, roughness: 0.9, flatShading: true }),
  chrome: new THREE.MeshStandardMaterial({ color: CHROME_COLOR, roughness: 0.4, metalness: 0.5, flatShading: true }),
  luggage: new THREE.MeshStandardMaterial({ color: LUGGAGE_COLOR, roughness: 0.9, flatShading: true }),
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

/** A pair of wheels on a shared axle, built around the origin so the mesh spins on its x axis. */
function buildAxle(radius: number, track: number, width: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    const wheel = new THREE.CylinderGeometry(radius, radius, width, 9);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate((side * track) / 2, 0, 0);
    parts.push(wheel);
  }
  return mergeParts(parts, "vehicle axle");
}

/** A single wheel, same idea, for the tuktuk's front fork. */
function buildWheel(radius: number, width: number): THREE.BufferGeometry {
  const wheel = new THREE.CylinderGeometry(radius, radius, width, 9);
  wheel.rotateZ(Math.PI / 2);
  return wheel;
}

/**
 * The tour car: a small 4x4 van of the kind that actually drives these routes,
 * with a roof rack and luggage on top since it spends the trip hauling bags
 * between hotels. Merged per colour, so the whole vehicle is a handful of draw
 * calls (the same treatment Train3D.tsx and NineArchesBridge.tsx use).
 */
function buildCar() {
  const half = CAR_WIDTH / 2;
  const bodyTop = CAR_FLOOR + CAR_BODY_H;
  const cabinTop = bodyTop + CAR_CABIN_H;
  const cabinFront = CAR_CABIN_Z + CAR_CABIN_LENGTH / 2;
  const nose = CAR_LENGTH / 2;

  const shell = mergeParts(
    [
      box(CAR_WIDTH, CAR_BODY_H, CAR_LENGTH, 0, CAR_FLOOR + CAR_BODY_H / 2, 0),
      box(CAR_WIDTH - 0.006, CAR_CABIN_H, CAR_CABIN_LENGTH, 0, bodyTop + CAR_CABIN_H / 2, CAR_CABIN_Z),
      // Wheel arches, which is what stops the sides reading as a plain slab.
      ...[-1, 1].flatMap((side) =>
        [-1, 1].map((end) =>
          box(0.007, 0.02, 0.042, side * (half - 0.001), CAR_FLOOR + 0.001, end * CAR_LENGTH * 0.29),
        ),
      ),
    ],
    "car shell",
  );

  const roof = mergeParts(
    [
      box(CAR_WIDTH - 0.002, 0.006, CAR_CABIN_LENGTH * 0.99, 0, cabinTop + 0.002, CAR_CABIN_Z),
      // Roof rack rails, thin enough to read as rails rather than as a second roof.
      ...[-1, 1].map((side) =>
        box(0.004, 0.005, CAR_CABIN_LENGTH * 0.8, side * 0.028, cabinTop + 0.007, CAR_CABIN_Z - 0.004),
      ),
    ],
    "car roof",
  );

  const glass = mergeParts(
    [
      // Side glass, one box spanning the full width so both sides show at once.
      box(CAR_WIDTH - 0.001, CAR_CABIN_H * 0.5, CAR_CABIN_LENGTH * 0.62, 0, bodyTop + CAR_CABIN_H * 0.62, CAR_CABIN_Z - 0.006),
      // Windscreen, raked back and sitting in the cabin's front face rather
      // than floating ahead of it, where it reads as a light bar.
      (() => {
        const screen = new THREE.BoxGeometry(CAR_WIDTH - 0.016, CAR_CABIN_H * 0.72, 0.006);
        screen.rotateX(-0.38);
        screen.translate(0, bodyTop + CAR_CABIN_H * 0.55, cabinFront - 0.002);
        return screen;
      })(),
    ],
    "car glass",
  );

  const trim = mergeParts(
    [
      // Bumpers, and the sill line joining the wheel arches.
      box(CAR_WIDTH - 0.004, 0.009, 0.007, 0, CAR_FLOOR + 0.009, nose - 0.002),
      box(CAR_WIDTH - 0.004, 0.009, 0.007, 0, CAR_FLOOR + 0.009, -nose + 0.002),
    ],
    "car trim",
  );

  const lamp = mergeParts(
    [-1, 1].map((side) => box(0.012, 0.008, 0.005, side * 0.026, CAR_FLOOR + CAR_BODY_H * 0.68, nose - 0.001)),
    "car lamps",
  );

  const luggage = mergeParts(
    [
      box(0.04, 0.011, 0.042, 0, cabinTop + 0.011, CAR_CABIN_Z - 0.006),
      box(0.028, 0.009, 0.026, 0.004, cabinTop + 0.021, CAR_CABIN_Z - 0.001),
    ],
    "car luggage",
  );

  return {
    shell,
    roof,
    glass,
    trim,
    lamp,
    luggage,
    axle: buildAxle(CAR_WHEEL_R, CAR_WIDTH + 0.008, 0.012),
    axleZ: CAR_LENGTH * 0.29,
    wheelRadius: CAR_WHEEL_R,
  };
}

/**
 * The tuktuk. Three wheels and the arched canopy are the whole silhouette: a
 * four-wheeled box in tuktuk orange just reads as a small car, so the single
 * front wheel on its fork is the detail that earns its triangles.
 */
function buildTuktuk() {
  const half = TUK_WIDTH / 2;
  const bodyTop = TUK_FLOOR + TUK_BODY_H;
  const canopyY = bodyTop + 0.024;
  const nose = TUK_LENGTH / 2;

  const shell = mergeParts(
    [
      // Passenger tub at the back, over the driven axle.
      box(TUK_WIDTH, TUK_BODY_H, TUK_LENGTH * 0.58, 0, TUK_FLOOR + TUK_BODY_H / 2, -TUK_LENGTH * 0.19),
      // Cowl over the front wheel, narrowing to the prow. Two steps rather than
      // one, so the front reads as tapering instead of as a bumper stack.
      box(TUK_WIDTH * 0.7, TUK_BODY_H * 0.95, TUK_LENGTH * 0.26, 0, TUK_FLOOR + TUK_BODY_H * 0.48, TUK_LENGTH * 0.19),
      box(TUK_WIDTH * 0.4, TUK_BODY_H * 0.8, TUK_LENGTH * 0.16, 0, TUK_FLOOR + TUK_BODY_H * 0.44, TUK_LENGTH * 0.37),
      // Rear panel closing the back, and the side panels rising from the tub to
      // the canopy over the rear half. Without them the roof reads as a table on
      // four stilts; a real tuktuk is only open at the sides where you get in.
      box(TUK_WIDTH, 0.023, 0.008, 0, bodyTop + 0.011, -TUK_LENGTH * 0.44),
      ...[-1, 1].map((side) =>
        box(0.006, 0.023, TUK_LENGTH * 0.24, side * (half - 0.003), bodyTop + 0.011, -TUK_LENGTH * 0.33),
      ),
    ],
    "tuktuk shell",
  );

  const canopy = mergeParts(
    [
      // Sized to the tub it covers. Any wider and it reads as a table on wheels.
      box(TUK_WIDTH + 0.002, 0.007, TUK_LENGTH * 0.6, 0, canopyY, -TUK_LENGTH * 0.17),
      // Slight brow over the driver, hinting at the curved hood.
      box(TUK_WIDTH * 0.62, 0.005, 0.014, 0, canopyY - 0.004, TUK_LENGTH * 0.08),
      // Front posts holding it up over the open sides; the rear corners are
      // carried by the shell's own side panels.
      ...[-1, 1].map((side) =>
        // At the roof's own front edge, so nothing hangs unsupported over the driver.
        box(0.005, 0.024, 0.005, side * (half - 0.004), bodyTop + 0.012, TUK_LENGTH * 0.1),
      ),
    ],
    "tuktuk canopy",
  );

  const glass = (() => {
    const screen = new THREE.BoxGeometry(TUK_WIDTH * 0.62, 0.02, 0.005);
    screen.rotateX(-0.28);
    screen.translate(0, bodyTop + 0.009, TUK_LENGTH * 0.06);
    return screen;
  })();

  const chrome = mergeParts(
    [
      // Front fork legs, dropping from the cowl to the single wheel's hub.
      ...[-1, 1].map((side) => box(0.004, 0.022, 0.005, side * 0.01, TUK_WHEEL_R + 0.009, TUK_LENGTH * 0.42)),
      // Handlebar, visible from above and unmistakably tuktuk.
      box(0.038, 0.004, 0.005, 0, TUK_FLOOR + TUK_BODY_H * 0.95, TUK_LENGTH * 0.15),
    ],
    "tuktuk chrome",
  );

  const lamp = box(0.011, 0.011, 0.005, 0, TUK_FLOOR + TUK_BODY_H * 0.55, nose + 0.004);

  return {
    shell,
    canopy,
    glass,
    chrome,
    lamp,
    axle: buildAxle(TUK_WHEEL_R, TUK_WIDTH + 0.004, 0.011),
    axleZ: -TUK_LENGTH * 0.26,
    frontWheel: buildWheel(TUK_WHEEL_R, 0.009),
    frontWheelZ: TUK_LENGTH * 0.42,
    wheelRadius: TUK_WHEEL_R,
  };
}

// Dimensions are constants, so both are built once for the app rather than per
// mount — these vehicles mount and unmount on every tour transition.
const CAR_GEOMETRY = buildCar();
const TUKTUK_GEOMETRY = buildTuktuk();

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
 *
 * Train legs borrow Train3D's own locomotive rather than modelling a second
 * one, so the train you follow along a leg is the train you see shuttling the
 * Kandy–Ella line afterwards.
 */
export function RoadVehicle3D({ from, to, kind }: RoadVehicle3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const axleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const startRef = useRef<number | null>(null);

  const curve = useMemo(() => buildRouteCurve(from, to), [from.x, from.z, to.x, to.z]);
  // Constant over the leg, so the wheels roll at whatever pace this particular
  // (short or long) segment demands to arrive with the camera.
  const speed = useMemo(() => curve.getLength() / TRAVEL_DURATION, [curve]);

  const parts = kind === "car" ? CAR_GEOMETRY : kind === "tuktuk" ? TUKTUK_GEOMETRY : null;

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

    if (parts && u < 1) {
      const spin = ((clock.elapsedTime - startRef.current) * speed) / parts.wheelRadius;
      for (const axle of axleRefs.current) {
        if (axle) axle.rotation.x = spin;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {kind === "train" && <TrainCar variant="loco" speed={speed} />}

      {kind === "car" && (
        <>
          <mesh geometry={CAR_GEOMETRY.shell} material={materials.car} />
          <mesh geometry={CAR_GEOMETRY.roof} material={materials.carRoof} />
          <mesh geometry={CAR_GEOMETRY.glass} material={materials.glass} />
          <mesh geometry={CAR_GEOMETRY.trim} material={materials.chrome} />
          <mesh geometry={CAR_GEOMETRY.lamp} material={materials.lamp} />
          <mesh geometry={CAR_GEOMETRY.luggage} material={materials.luggage} />
          {[-1, 1].map((end, k) => (
            <mesh
              key={end}
              ref={(m) => {
                axleRefs.current[k] = m;
              }}
              geometry={CAR_GEOMETRY.axle}
              material={materials.tyre}
              position={[0, CAR_WHEEL_R, end * CAR_GEOMETRY.axleZ]}
            />
          ))}
        </>
      )}

      {kind === "tuktuk" && (
        <>
          <mesh geometry={TUKTUK_GEOMETRY.shell} material={materials.tuktuk} />
          <mesh geometry={TUKTUK_GEOMETRY.canopy} material={materials.tuktukCanopy} />
          <mesh geometry={TUKTUK_GEOMETRY.glass} material={materials.glass} />
          <mesh geometry={TUKTUK_GEOMETRY.chrome} material={materials.chrome} />
          <mesh geometry={TUKTUK_GEOMETRY.lamp} material={materials.lamp} />
          <mesh
            ref={(m) => {
              axleRefs.current[0] = m;
            }}
            geometry={TUKTUK_GEOMETRY.axle}
            material={materials.tyre}
            position={[0, TUK_WHEEL_R, TUKTUK_GEOMETRY.axleZ]}
          />
          <mesh
            ref={(m) => {
              axleRefs.current[1] = m;
            }}
            geometry={TUKTUK_GEOMETRY.frontWheel}
            material={materials.tyre}
            position={[0, TUK_WHEEL_R, TUKTUK_GEOMETRY.frontWheelZ]}
          />
        </>
      )}
    </group>
  );
}
