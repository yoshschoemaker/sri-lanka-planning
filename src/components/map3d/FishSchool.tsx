import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const FISH_COLORS = ["#e8a13c", "#4fb3c9", "#e8a13c"];
const SWIM_SPEED = 0.9;
/** Body-primitive dimensions below are tuned at 1x; this blows the whole school up so it actually reads at diorama viewing distance (matches Leopard/Elephant/Temple's own scale-up). */
const SCALE = 2.3;

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
 * plane (y = -0.18) so the fish read as swimming on top of the lagoon shader
 * rather than embedded in it.
 */
export function FishSchool({ x, z }: { x: number; z: number }) {
  const fishRefs = useRef<(THREE.Group | null)[]>([]);
  const tailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * SWIM_SPEED + phase.current;
    FISH.forEach((fish, i) => {
      const group = fishRefs.current[i];
      if (group) {
        const angle = t + fish.angleOffset;
        group.position.x = Math.cos(angle) * fish.radius;
        group.position.z = Math.sin(angle) * fish.radius;
        group.position.y = Math.sin(angle * 2 + fish.bobOffset) * 0.008;
        group.rotation.y = -angle + Math.PI / 2;
      }
      const tail = tailRefs.current[i];
      if (tail) tail.rotation.y = Math.sin(t * 6 + fish.bobOffset) * 0.5;
    });
  });

  return (
    <group position={[x, -0.13, z]} scale={SCALE}>
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
