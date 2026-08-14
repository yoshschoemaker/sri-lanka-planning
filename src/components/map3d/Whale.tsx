import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useAppearanceCycle } from "../../utils/useAppearanceCycle";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import { useSeaWander } from "../../utils/useSeaWander";
import { SEA_LEVEL_Y, WATER_TROUGH_Y } from "./seaLevel";

const BODY_COLOR = "#2c5b6e";
const BODY_COLOR_LIGHT = "#3d7a8f";
const SCALE = 2.9;
const BASE_Y = SEA_LEVEL_Y + 0.03;

/** Heading it holds when it isn't travelling (reduced motion). */
const BASE_TURN = 0.3;

/**
 * Patrol loop around WHALE_POSITION: wide along the coast, shallow towards it.
 * Verified to stay ≥0.44 world units off the coastline ring over the whole
 * path, so the whale never swims onto the beach.
 */
const WANDER = { radiusX: 0.4, radiusZ: 0.1, speed: 0.045 };

/** Seconds the spout + hard tail slap reaction plays before settling back to the ambient bob. */
const REACTION_DURATION = 1.8;

/** Seconds it stays up between dives, and the range of seconds it stays down. */
const VISIBLE_FOR = 26;
const MIN_GAP = 22;
const MAX_GAP = 55;
/**
 * How deep the dive goes, in world units below BASE_Y. Enough to put the
 * dorsal ridge (~0.12 above the group origin at this scale) under the lowest
 * wave trough, so the opaque sea hides it completely and no opacity fade is
 * needed: the whale simply goes under, the way a real one does.
 */
const DIVE_DEPTH = BASE_Y - WATER_TROUGH_Y + 0.2;

/**
 * A small blue whale (back and tail breaking the surface), a nod to
 * Mirissa's whale watching trips. Sits just above Water.tsx's plane like
 * FishSchool/Turtle, further offshore since whale watching
 * happens well out at sea rather than right off the beach. It slowly swims a
 * bounded patrol loop around its anchor (useSeaWander) instead of hovering on
 * one spot, turning to face wherever it's heading. It is also not permanently
 * there: it surfaces for half a minute, then sounds — nose down, sinking below
 * the opaque sea until it is simply gone — and comes back up somewhere else
 * along its patrol a while later (useAppearanceCycle). Clicking it
 * triggers a one-shot spout + hard tail slap on top of the ambient bob, the
 * same "wake up the diorama" easter egg Leopard/Elephant/Turtle each have
 * their own version of.
 */
export function Whale({ x, z, prefersReducedMotion }: { x: number; z: number; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  const prevFade = useRef(0);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 0.7, minGap: 6, maxGap: 13, duration: 2.2 });
  const wander = useSeaWander(WANDER);
  const { visible, sample } = useAppearanceCycle({
    visibleFor: VISIBLE_FOR,
    minGap: MIN_GAP,
    maxGap: MAX_GAP,
    // A long ramp: this is a sounding dive, not a fade, and a whale that size
    // takes its time going down and coming back up.
    fade: 3.5,
    firstDelay: 2,
    enabled: !prefersReducedMotion,
  });

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime * 0.4 + phase.current;
    const e = prefersReducedMotion ? null : envelope();
    const { t: it, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime, !prefersReducedMotion);
    const { dx, dz, heading } = wander(clock.elapsedTime, !prefersReducedMotion);
    const { fade } = sample();

    // Nose down while it's going under, nose up on the way back — read off how
    // fast the dive ramp is moving, which is what makes the dive a manoeuvre
    // rather than an elevator.
    const descent = delta > 0 ? (prevFade.current - fade) / delta : 0;
    prevFade.current = fade;
    const divePitch = Math.max(-0.35, Math.min(0.35, descent * DIVE_DEPTH * 3));

    if (groupRef.current) {
      // Actually travels its patrol loop, nose pointed where it's going. The
      // loop keeps running while it's under, so it resurfaces somewhere else
      // along the patrol rather than in the hole it left.
      groupRef.current.position.x = x + dx;
      groupRef.current.position.z = z + dz;
      // The fidget is a shallow dive: the back sinks and the whole body rolls
      // into it. The cycle's ramp is the real dive, on top of that.
      groupRef.current.position.y =
        BASE_Y + (prefersReducedMotion ? 0 : Math.sin(t) * 0.026) - 0.012 * fidget - (1 - fade) * DIVE_DEPTH;
      groupRef.current.rotation.z =
        Math.sin(it * 0.8) * 0.09 + Math.sin(it * 0.29) * 0.04 + Math.sin(fidgetElapsed * 1.4) * 0.07 * fidget;
      // Back arcs out of the water and settles again on the same slow curve as the bob.
      groupRef.current.rotation.x =
        (prefersReducedMotion ? 0 : Math.sin(t - 0.8) * 0.05) - 0.06 * fidget + divePitch;
      groupRef.current.rotation.y =
        (prefersReducedMotion ? BASE_TURN : heading) + (prefersReducedMotion ? 0 : Math.sin(t * 0.21) * 0.06);
    }
    // A blue whale's flanks are the whole animal; a wide slow swell sells the scale.
    if (bodyRef.current) bodyRef.current.scale.set(1 + breath * 0.045, 0.5 + breath * 0.03, 2.2);
    if (tailRef.current) {
      const ambient = prefersReducedMotion ? 0 : Math.sin(t * 1.3) * 0.28 + Math.sin(t * 0.47) * 0.08;
      tailRef.current.rotation.z =
        ambient + Math.sin(fidgetElapsed * 3.2) * 0.28 * fidget + (e ? Math.sin(e.elapsed * 10) * 0.5 * e.strength : 0);
      tailRef.current.rotation.x = prefersReducedMotion ? 0 : Math.sin(t * 1.3 - 0.7) * 0.12;
    }
  });

  // Nothing to draw while it's down there: the dive ramp is part of the visible
  // window, so by the time this unmounts the whale is already under the sea.
  if (!visible) return null;

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
      <mesh ref={bodyRef} scale={[1, 0.5, 2.2]}>
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
