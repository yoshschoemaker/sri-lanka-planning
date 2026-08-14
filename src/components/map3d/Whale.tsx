import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";

const BODY_COLOR = "#2c5b6e";
const BODY_COLOR_LIGHT = "#3d7a8f";
const SCALE = 2.9;
const BASE_Y = -0.15;

/** Seconds the spout + hard tail slap reaction plays before settling back to the ambient bob. */
const REACTION_DURATION = 1.8;

/**
 * A small blue whale (back and tail breaking the surface), a nod to
 * Mirissa's whale watching trips. Sits just above Water.tsx's plane like
 * FishSchool/Turtle/WaveCrest, further offshore since whale watching
 * happens well out at sea rather than right off the beach. Clicking it
 * triggers a one-shot spout + hard tail slap on top of the ambient bob, the
 * same "wake up the diorama" easter egg Leopard/Elephant/Turtle each have
 * their own version of.
 */
export function Whale({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 0.7, minGap: 7, maxGap: 16, duration: 2.2 });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.4 + phase.current;
    const e = prefersReducedMotion ? null : envelope();
    const { t: it, fidget, fidgetElapsed } = idle(clock.elapsedTime, !prefersReducedMotion);

    if (groupRef.current) {
      // The fidget is a shallow dive: the back sinks and the whole body rolls into it.
      groupRef.current.position.y = BASE_Y + (prefersReducedMotion ? 0 : Math.sin(t) * 0.012) - 0.012 * fidget;
      groupRef.current.rotation.z = Math.sin(it * 0.8) * 0.05 + Math.sin(fidgetElapsed * 1.4) * 0.07 * fidget;
      groupRef.current.rotation.x = -0.06 * fidget;
    }
    if (tailRef.current) {
      const ambient = prefersReducedMotion ? 0 : Math.sin(t * 1.3) * 0.15;
      tailRef.current.rotation.z =
        ambient + Math.sin(fidgetElapsed * 3.2) * 0.28 * fidget + (e ? Math.sin(e.elapsed * 10) * 0.5 * e.strength : 0);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[x, BASE_Y, z]}
      rotation={[0, 0.3, 0]}
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
      <mesh scale={[1, 0.5, 2.2]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.6} flatShading />
      </mesh>

      <mesh position={[0, 0.024, 0.01]} scale={[0.5, 0.5, 0.35]}>
        <coneGeometry args={[0.02, 0.03, 4]} />
        <meshStandardMaterial color={BODY_COLOR_LIGHT} roughness={0.6} flatShading />
      </mesh>

      <mesh ref={tailRef} position={[0, 0.012, -0.095]} scale={[1, 0.15, 0.6]}>
        <coneGeometry args={[0.03, 0.05, 3]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.6} flatShading />
      </mesh>

      {reacting && !prefersReducedMotion && (
        <Sparkles count={14} scale={[0.05, 0.16, 0.05]} position={[0, 0.045, 0.02]} size={2.5} speed={1.4} opacity={0.9} color="#eafcff" />
      )}

      {reacting && (
        <Html position={[0, 0.1, 0.02]} center zIndexRange={CRITTER_HTML_Z}>
          <div className="marker-label-glass pointer-events-none whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream">
            Pfffft! 🐋
          </div>
        </Html>
      )}
    </group>
  );
}
