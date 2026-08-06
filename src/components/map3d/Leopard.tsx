import { ISLAND_TOP_Y } from "./Island";

const COAT_COLOR = "#c9903f";
const SPOT_COLOR = "#5c3a1e";
/** Body-primitive dimensions below are tuned at 1x; this blows the whole critter up so it actually reads at diorama viewing distance. */
const SCALE = 2.6;

const LEG_OFFSETS: [number, number][] = [
  [-0.018, -0.032],
  [0.018, -0.032],
  [-0.018, 0.026],
  [0.018, 0.026],
];

const SPOT_OFFSETS: [number, number, number][] = [
  [0.018, 0.038, 0.03],
  [-0.014, 0.04, 0.005],
  [0.012, 0.036, -0.02],
  [-0.016, 0.035, -0.04],
];

/**
 * Purely decorative low-poly leopard, a nod to Wilpattu's sightings. Body
 * sits low and long (crouching stance) rather than upright, which reads
 * better as "cat" than a sphere-with-legs would at this scale.
 */
export function Leopard({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, ISLAND_TOP_Y, z]} rotation={[0, -0.4, 0]} scale={SCALE}>
      <mesh position={[0, 0.024, 0]} scale={[0.8, 0.7, 1.6]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
      </mesh>

      <mesh position={[0, 0.03, 0.062]} scale={[0.75, 0.75, 0.75]}>
        <sphereGeometry args={[0.026, 7, 6]} />
        <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.014, 0.05, 0.068]}>
          <coneGeometry args={[0.008, 0.014, 4]} />
          <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
        </mesh>
      ))}

      <mesh position={[0, 0.04, -0.07]} rotation={[-0.7, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.003, 0.06, 5]} />
        <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
      </mesh>

      {LEG_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.008, dz]}>
          <cylinderGeometry args={[0.007, 0.007, 0.016, 5]} />
          <meshStandardMaterial color={COAT_COLOR} roughness={0.85} flatShading />
        </mesh>
      ))}

      {SPOT_OFFSETS.map(([dx, dy, dz], i) => (
        <mesh key={i} position={[dx, dy, dz]}>
          <sphereGeometry args={[0.006, 5, 4]} />
          <meshStandardMaterial color={SPOT_COLOR} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}
