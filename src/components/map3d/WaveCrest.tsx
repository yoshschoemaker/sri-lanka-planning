import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const FOAM_COLOR = "#ffffff";
const BOB_AMPLITUDE = 0.018;
const DRIFT_AMPLITUDE = 0.02;
const BASE_SPEED = 0.8;
const ARC_SPAN = Math.PI * 1.1;

/** Three nested arcs, largest-faintest outward — the same "ripples on the water" symbol used on countless stylized maps, which reads instantly as "wave" at a glance where a single torus or foam blob didn't. */
const ARCS = [
  { radius: 0.055, tube: 0.009, baseOpacity: 0.8 },
  { radius: 0.09, tube: 0.008, baseOpacity: 0.55 },
  { radius: 0.125, tube: 0.0065, baseOpacity: 0.32 },
];

/**
 * Purely decorative: three concentric foam arcs standing in for a wave,
 * with a pulse that travels from the inner arc to the outer one so it
 * reads as a ripple lapping outward rather than three static rings. Tuned
 * quiet since TripMap3D scatters over a dozen of these around the
 * coastline — many faint ones read as "the water is alive" where one loud
 * one would just look like a loud one.
 */
export function WaveCrest({ x, z }: { x: number; z: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const phase = useRef(Math.random() * Math.PI * 2);
  const speed = useRef(BASE_SPEED * (0.85 + Math.random() * 0.3));

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime * speed.current + phase.current;
    group.position.y = Math.sin(t) * BOB_AMPLITUDE;
    group.position.x = x + Math.sin(t * 0.6) * DRIFT_AMPLITUDE;
    group.rotation.z = Math.sin(t * 0.5) * 0.06;

    ARCS.forEach((arc, i) => {
      const material = materialRefs.current[i];
      if (!material) return;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.3 - i * 1.1);
      material.opacity = arc.baseOpacity * (0.55 + 0.45 * pulse);
    });
  });

  return (
    <group ref={groupRef} position={[x, -0.1, z]} rotation={[0, 0.3, 0]}>
      {ARCS.map((arc, i) => (
        <mesh key={i} rotation={[-Math.PI / 2.5, 0, 0]} position={[0, i * 0.002, 0]}>
          <torusGeometry args={[arc.radius, arc.tube, 5, 12, ARC_SPAN]} />
          <meshStandardMaterial
            ref={(m) => {
              materialRefs.current[i] = m;
            }}
            color={FOAM_COLOR}
            emissive={FOAM_COLOR}
            emissiveIntensity={0.3}
            roughness={0.4}
            transparent
            opacity={arc.baseOpacity}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}
