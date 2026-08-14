import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";

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

const BASE_TURN = 0.5;
const HEAD_REST_Y = -0.002;

/**
 * A small sea turtle drifting just under the surface, a nod to the turtle
 * spotting/nesting-beach activities at Hiriketiya (Rekawa) and Hikkaduwa.
 * Sits just above Water.tsx's plane like FishSchool/WaveCrest. The flippers
 * paddle non-stop and it changes heading a little every so often
 * (useIdleMotion). Clicking it pokes its head above the surface for a
 * moment, the same "wake up the diorama" easter egg Leopard/Elephant/Whale
 * each have their own version of.
 */
export function Turtle({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const flipperRefs = useRef<(THREE.Mesh | null)[]>([]);
  const phase = useRef(Math.random() * Math.PI * 2);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 1.2, minGap: 5, maxGap: 12, duration: 1.7 });

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime * 0.45 + phase.current;
    const e = prefersReducedMotion ? null : envelope();
    const { t: it, fidget, fidgetElapsed } = idle(clock.elapsedTime, !prefersReducedMotion);

    group.position.y = BASE_Y + (prefersReducedMotion ? 0 : Math.sin(t) * 0.01) + (e ? 0.018 * e.strength : 0);
    group.rotation.z = prefersReducedMotion ? 0 : Math.sin(t * 0.7) * 0.05;
    group.rotation.y = BASE_TURN + Math.sin(fidgetElapsed * 1.6) * 0.22 * fidget;

    if (headRef.current) {
      headRef.current.position.y =
        HEAD_REST_Y + Math.sin(it * 0.9) * 0.002 + 0.006 * fidget + (e ? 0.014 * e.strength : 0);
    }

    // The two pairs paddle in counterphase, the way a turtle actually rows.
    for (let i = 0; i < flipperRefs.current.length; i++) {
      const flipper = flipperRefs.current[i];
      if (!flipper) continue;
      const pair = i < 2 ? 0 : Math.PI;
      flipper.rotation.x = Math.sin(it * 1.5 + pair) * (0.22 + 0.35 * fidget);
    }
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

      <mesh ref={headRef} position={[0, HEAD_REST_Y, 0.038]} scale={[0.55, 0.5, 0.55]}>
        <sphereGeometry args={[0.02, 6, 5]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.85} flatShading />
      </mesh>

      {FLIPPER_OFFSETS.map(([dx, dz], i) => (
        <mesh
          key={i}
          ref={(m) => {
            flipperRefs.current[i] = m;
          }}
          position={[dx, -0.006, dz]}
          rotation={[0, 0, dx > 0 ? 0.5 : -0.5]}
          scale={[0.9, 0.35, 0.55]}
        >
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.85} flatShading />
        </mesh>
      ))}

      {reacting && (
        <Html position={[0, 0.06, 0.05]} center zIndexRange={CRITTER_HTML_Z}>
          <div className="marker-label-glass pointer-events-none whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream">
            Kopje boven! 🐢
          </div>
        </Html>
      )}
    </group>
  );
}
