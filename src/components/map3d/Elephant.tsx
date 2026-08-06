import { ISLAND_TOP_Y } from "./Island";

const BODY_COLOR = "#96908a";
const BODY_COLOR_DARK = "#5c5650";
/** Body-primitive dimensions below are tuned at 1x; this blows the whole critter up so it actually reads at diorama viewing distance. */
const SCALE = 2.6;

const LEG_OFFSETS: [number, number][] = [
  [-0.025, -0.038],
  [0.025, -0.038],
  [-0.025, 0.03],
  [0.025, 0.03],
];

/**
 * Purely decorative low-poly elephant, a nod to Udawalawe's herds. Ears and
 * trunk are the two features that keep a silhouette this small readable as
 * "elephant" rather than "grey blob".
 */
export function Elephant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, ISLAND_TOP_Y, z]} rotation={[0, 1.3, 0]} scale={SCALE}>
      <mesh position={[0, 0.042, 0]} scale={[1, 0.85, 1.4]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
      </mesh>

      <mesh position={[0, 0.05, 0.065]} scale={[0.85, 0.85, 0.85]}>
        <sphereGeometry args={[0.032, 7, 6]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.038, 0.058, 0.055]} rotation={[0, 0, side * 0.6]} scale={[0.85, 1.2, 0.18]}>
          <sphereGeometry args={[0.026, 6, 5]} />
          <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
        </mesh>
      ))}

      <mesh position={[0, 0.025, 0.09]} rotation={[0.55, 0, 0]}>
        <coneGeometry args={[0.009, 0.05, 5]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.9} flatShading />
      </mesh>

      {LEG_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.012, dz]}>
          <cylinderGeometry args={[0.011, 0.011, 0.024, 5]} />
          <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
        </mesh>
      ))}

      <mesh position={[0, 0.04, -0.068]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.003, 0.03, 4]} />
        <meshStandardMaterial color={BODY_COLOR_DARK} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}
