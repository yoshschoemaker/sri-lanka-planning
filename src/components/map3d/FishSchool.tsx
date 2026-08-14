import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAppearanceCycle } from "../../utils/useAppearanceCycle";
import { useSeaWander } from "../../utils/useSeaWander";
import { SEA_LEVEL_Y, WATER_TROUGH_Y } from "./seaLevel";

const FISH_COLORS = ["#e8a13c", "#4fb3c9", "#e8a13c"];
const SWIM_SPEED = 0.9;
/**
 * Loop the whole school drifts along around FISH_SCHOOL_POSITION, so it doesn't
 * circle the same square metre forever. Tighter than Turtle/Whale's: the
 * coastline bends in close here. Verified to stay ≥0.15 world units off the
 * coastline ring over the whole path.
 */
const WANDER = { radiusX: 0.18, radiusZ: 0.07, speed: 0.04 };
/** Body-primitive dimensions below are tuned at 1x; this blows the whole school up so it actually reads at diorama viewing distance (matches Leopard/Elephant/Temple's own scale-up). */
const SCALE = 2.3;

/** Base y of the school when it's up at the reef. */
const BASE_Y = SEA_LEVEL_Y + 0.05;

/** Seconds the school hangs around the reef, and the range of seconds it's gone. */
const VISIBLE_FOR = 34;
const MIN_GAP = 14;
const MAX_GAP = 34;
/** Deep enough to put the school under the lowest wave trough, where the opaque sea hides it. */
const DIVE_DEPTH = BASE_Y - WATER_TROUGH_Y + 0.08;
/** How much wider the circle gets as the school breaks up, as a multiple of each fish's own radius. */
const SCATTER = 1.6;

interface FishSpec {
  color: string;
  radius: number;
  angleOffset: number;
  bobOffset: number;
}

const FISH: FishSpec[] = [
  { color: FISH_COLORS[0], radius: 0.045, angleOffset: 0, bobOffset: 0 },
  { color: FISH_COLORS[1], radius: 0.062, angleOffset: 2.1, bobOffset: 1.4 },
  { color: FISH_COLORS[2], radius: 0.05, angleOffset: 4.2, bobOffset: 2.8 },
];

function FishBody({ color, tailRef }: { color: string; tailRef: (m: THREE.Mesh | null) => void }) {
  return (
    <>
      <mesh scale={[1, 0.6, 0.45]}>
        <sphereGeometry args={[0.02, 7, 5]} />
        <meshStandardMaterial color={color} roughness={0.6} flatShading />
      </mesh>
      <mesh ref={tailRef} position={[-0.02, 0, 0]}>
        <coneGeometry args={[0.012, 0.018, 3]} />
        <meshStandardMaterial color={color} roughness={0.6} flatShading />
      </mesh>
    </>
  );
}

/**
 * A tiny school of fish circling just under the water's surface, a nod to
 * Hikkaduwa's Coral Sanctuary snorkel spot. Sits just above Water.tsx's
 * plane (SEA_LEVEL_Y) so the fish read as swimming on top of the lagoon shader
 * rather than embedded in it. The school also roams slowly around its anchor
 * (useSeaWander), so it isn't pinned to one patch of reef, and it doesn't stay
 * forever: the circle widens as the fish break up and drop below the opaque sea,
 * and tightens again when they re-form a while later (useAppearanceCycle).
 *
 * Under prefers-reduced-motion the school stays put at the reef, as before.
 */
export function FishSchool({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const schoolRef = useRef<THREE.Group>(null);
  const fishRefs = useRef<(THREE.Group | null)[]>([]);
  const tailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const phase = useRef(Math.random() * Math.PI * 2);
  const wander = useSeaWander(WANDER);
  const { visible, sample } = useAppearanceCycle({
    visibleFor: VISIBLE_FOR,
    minGap: MIN_GAP,
    maxGap: MAX_GAP,
    fade: 2.5,
    // Offset from Whale's and Turtle's, so the three don't leave together.
    firstDelay: 6,
    enabled: !prefersReducedMotion,
  });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * SWIM_SPEED + phase.current;
    const { fade } = sample();
    // Circle widens as the school breaks up and tightens again as it re-forms,
    // so leaving reads as fish scattering into the deep rather than a group
    // sliding down a lift shaft.
    const spread = 1 + (1 - fade) * SCATTER;

    if (schoolRef.current) {
      // The school as a whole roams; the fish keep circling within it.
      const { dx, dz } = wander(clock.elapsedTime, !prefersReducedMotion);
      schoolRef.current.position.x = x + dx;
      schoolRef.current.position.z = z + dz;
      schoolRef.current.position.y = BASE_Y - (1 - fade) * DIVE_DEPTH;
    }
    FISH.forEach((fish, i) => {
      const group = fishRefs.current[i];
      if (group) {
        const angle = t + fish.angleOffset;
        group.position.x = Math.cos(angle) * fish.radius * spread;
        group.position.z = Math.sin(angle) * fish.radius * spread;
        group.position.y = Math.sin(angle * 2 + fish.bobOffset) * 0.008;
        group.rotation.y = -angle + Math.PI / 2;
      }
      const tail = tailRefs.current[i];
      if (tail) tail.rotation.y = Math.sin(t * 6 + fish.bobOffset) * 0.5;
    });
  });

  if (!visible) return null;

  return (
    <group ref={schoolRef} position={[x, BASE_Y, z]} scale={SCALE}>
      {FISH.map((fish, i) => (
        <group
          key={i}
          ref={(g) => {
            fishRefs.current[i] = g;
          }}
        >
          <FishBody
            color={fish.color}
            tailRef={(m) => {
              tailRefs.current[i] = m;
            }}
          />
        </group>
      ))}
    </group>
  );
}
