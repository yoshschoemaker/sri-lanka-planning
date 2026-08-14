import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useAppearanceCycle } from "../../utils/useAppearanceCycle";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import { useSeaWander } from "../../utils/useSeaWander";
import { SEA_LEVEL_Y, WATER_TROUGH_Y } from "./seaLevel";

const SHELL_COLOR = "#3d6b4a";
const SKIN_COLOR = "#5c8f6e";
const SCALE = 2.6;
const BASE_Y = SEA_LEVEL_Y + 0.04;

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
 * Patrol loop around TURTLE_POSITION: wide along the coast, shallow towards it.
 * Verified to stay ≥0.17 world units off the coastline ring over the whole
 * path, so the turtle never drifts onto the sand.
 */
const WANDER = { radiusX: 0.28, radiusZ: 0.11, speed: 0.05 };

/** Seconds it drifts at the surface, and the range of seconds it spends down below. */
const VISIBLE_FOR = 30;
const MIN_GAP = 16;
const MAX_GAP = 40;
/**
 * How far below BASE_Y the dive goes: enough to put the top of the shell under
 * the lowest wave trough, so the opaque sea hides it and no opacity fade is
 * needed. Shorter than the whale's — there's much less turtle to hide.
 */
const DIVE_DEPTH = BASE_Y - WATER_TROUGH_Y + 0.1;

/**
 * A small sea turtle drifting just under the surface, a nod to the turtle
 * spotting/nesting-beach activities at Hiriketiya (Rekawa) and Hikkaduwa.
 * Sits just above Water.tsx's plane like FishSchool. The flippers
 * paddle non-stop, it changes heading a little every so often
 * (useIdleMotion), and it slowly swims a bounded patrol loop around its anchor
 * (useSeaWander) rather than treading water in one spot. Like the whale it also
 * dives: half a minute at the surface, then down below the opaque sea and back
 * up somewhere else along the patrol (useAppearanceCycle).
 * Clicking it pokes its head above the surface for a
 * moment, the same "wake up the diorama" easter egg Leopard/Elephant/Whale
 * each have their own version of.
 */
export function Turtle({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const flipperRefs = useRef<(THREE.Mesh | null)[]>([]);
  const phase = useRef(Math.random() * Math.PI * 2);
  const prevFade = useRef(0);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 1.2, minGap: 4, maxGap: 10, duration: 1.7 });
  const wander = useSeaWander(WANDER);
  const { visible, sample } = useAppearanceCycle({
    visibleFor: VISIBLE_FOR,
    minGap: MIN_GAP,
    maxGap: MAX_GAP,
    fade: 2.5,
    // Offset from the whale's and the school's, so the three of them aren't all
    // surfacing and sounding on the same beat.
    firstDelay: 11,
    enabled: !prefersReducedMotion,
  });

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime * 0.45 + phase.current;
    const e = prefersReducedMotion ? null : envelope();
    const { t: it, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime, !prefersReducedMotion);
    const { dx, dz, heading } = wander(clock.elapsedTime, !prefersReducedMotion);
    const { fade } = sample();

    // Nose down on the way under, nose up on the way back, read off the dive
    // ramp's own rate.
    const descent = delta > 0 ? (prevFade.current - fade) / delta : 0;
    prevFade.current = fade;
    const divePitch = Math.max(-0.4, Math.min(0.4, descent * DIVE_DEPTH * 4));

    // Actually covers ground along its patrol loop, nose pointed where it's going.
    group.position.x = x + dx;
    group.position.z = z + dz;
    group.position.y =
      BASE_Y +
      (prefersReducedMotion ? 0 : Math.sin(t) * 0.022) +
      (e ? 0.018 * e.strength : 0) -
      (1 - fade) * DIVE_DEPTH;
    group.rotation.z = prefersReducedMotion ? 0 : Math.sin(t * 0.7) * 0.11;
    // Nose dips and lifts with the bob, so the drift reads as swimming rather than sliding.
    group.rotation.x = (prefersReducedMotion ? 0 : Math.sin(t - 0.9) * 0.07) + divePitch;
    group.rotation.y =
      (prefersReducedMotion ? BASE_TURN : heading) +
      (prefersReducedMotion ? 0 : Math.sin(t * 0.28) * 0.09) +
      Math.sin(fidgetElapsed * 1.6) * 0.22 * fidget;

    // Shell swells on the breath curve; the turtle surfaces to breathe, so make it visible.
    if (shellRef.current) shellRef.current.scale.set(1 + breath * 0.03, 0.42 + breath * 0.02, 0.8 + breath * 0.02);

    if (headRef.current) {
      headRef.current.position.y =
        HEAD_REST_Y + Math.sin(it * 0.9) * 0.005 + 0.006 * fidget + (e ? 0.014 * e.strength : 0);
      headRef.current.rotation.y = Math.sin(it * 0.4) * 0.18;
    }

    // The two pairs paddle in counterphase, the way a turtle actually rows.
    for (let i = 0; i < flipperRefs.current.length; i++) {
      const flipper = flipperRefs.current[i];
      if (!flipper) continue;
      const pair = i < 2 ? 0 : Math.PI;
      // Rows harder while diving: that's what's driving it down.
      flipper.rotation.x = Math.sin(it * 1.5 + pair) * (0.34 + 0.35 * fidget + 0.3 * (1 - fade));
      flipper.rotation.y = Math.sin(it * 1.5 + pair) * 0.1;
    }
  });

  // Unmounts only once it's fully under: the dive itself is part of the window.
  if (!visible) return null;

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
      <mesh ref={shellRef} scale={[1, 0.42, 0.8]}>
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
