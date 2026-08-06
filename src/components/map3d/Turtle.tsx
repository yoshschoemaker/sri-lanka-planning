import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useClickReaction } from "../../utils/useClickReaction";

const SHELL_COLOR = "#3d6b4a";
const SKIN_COLOR = "#5c8f6e";
const SCALE = 2.6;
const BASE_Y = -0.14;

const FLIPPER_OFFSETS: [number, number][] = [
  [-0.026, -0.022],
  [0.026, -0.022],
  [-0.03, 0.018],
  [0.03, 0.018],
];

/** Seconds the head-poke reaction plays before settling back to the ambient drift. */
const REACTION_DURATION = 1.3;

/**
 * A small sea turtle drifting just under the surface, a nod to the turtle
 * spotting/nesting-beach activities at Tangalle (Rekawa) and Hikkaduwa.
 * Sits just above Water.tsx's plane like FishSchool/WaveCrest. Clicking it
 * pokes its head above the surface for a moment, the same "wake up the
 * diorama" easter egg Leopard/Elephant/Whale each have their own version of.
 */
export function Turtle({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime * 0.45 + phase.current;
    const e = prefersReducedMotion ? null : envelope();
    group.position.y = BASE_Y + (prefersReducedMotion ? 0 : Math.sin(t) * 0.01) + (e ? 0.018 * e.strength : 0);
    group.rotation.z = prefersReducedMotion ? 0 : Math.sin(t * 0.7) * 0.05;
    if (headRef.current) headRef.current.position.y = e ? -0.002 + 0.014 * e.strength : -0.002;
  });

  return (
    <group
      ref={groupRef}
      position={[x, BASE_Y, z]}
      rotation={[0, 0.5, 0]}
      scale={SCALE}
      onClick={(evt) => {
        evt.stopPropagation();
        trigger();
      }}
      onPointerOver={(evt) => {
        evt.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh scale={[1, 0.42, 0.8]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={SHELL_COLOR} roughness={0.8} flatShading />
      </mesh>

      <mesh ref={headRef} position={[0, -0.002, 0.038]} scale={[0.55, 0.5, 0.55]}>
        <sphereGeometry args={[0.02, 6, 5]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.85} flatShading />
      </mesh>

      {FLIPPER_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, -0.006, dz]} rotation={[0, 0, dx > 0 ? 0.5 : -0.5]} scale={[0.9, 0.35, 0.55]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.85} flatShading />
        </mesh>
      ))}

      {reacting && (
        <Html position={[0, 0.06, 0.05]} center>
          <div className="pointer-events-none whitespace-nowrap rounded-full bg-ink/95 px-2.5 py-1 font-serif text-xs font-semibold text-cream shadow-[var(--shadow-card)]">
            Kopje boven! 🐢
          </div>
        </Html>
      )}
    </group>
  );
}
