import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CRITTER_HTML_Z } from "./htmlLayers";
import { useClickReaction } from "../../utils/useClickReaction";
import { useIdleMotion } from "../../utils/useIdleMotion";
import type { MapScatter } from "../../utils/useMapScatter";
import type { WorldPoint } from "../../utils/projection3d";

const HIDE_COLOR = "#4a4a4e";
const HIDE_COLOR_DARK = "#33333a";
const HORN_COLOR = "#c8bfa8";

/** Body primitives below are authored at 1x; this blows the whole animal up so it reads at diorama viewing distance, same as the other ground mammals. */
const SCALE = 2.6;

/** Seconds the head-up snort lasts before it goes back to grazing. */
const REACTION_DURATION = 1.7;

/**
 * Where we'd like the buffalo to stand. It doesn't stand exactly here: the
 * nearest procedurally placed paddy field to this point wins, so the animal is
 * always actually in a rice field rather than beside where one happened not to
 * be placed.
 *
 * The open irrigated plain south-east of Sigiriya, not the wet-zone lowlands
 * where paddy is densest — the southwest is wall-to-wall canopy at this camera
 * angle, and an animal nobody can see is a waste of a draw call. Here the ground
 * is sparse scrub and rock, so the buffalo actually reads.
 */
const PADDY_ANCHOR: WorldPoint = { x: 1.05, z: 0.35 };

/** Head-down grazing angle, and how far up it comes when something startles it. */
const GRAZE_X = 0.62;

const LEG_OFFSETS: [number, number][] = [
  [-0.02, -0.03],
  [0.02, -0.03],
  [-0.02, 0.026],
  [0.02, 0.026],
];

/** Picks the paddy field closest to the anchor. Deterministic: the scatter is seeded, so this is the same field every load at a given detail level. */
function pickPaddy(paddy: MapScatter["paddy"]) {
  let best = paddy[0];
  let bestDistance = Infinity;
  for (const item of paddy) {
    const d = (item.x - PADDY_ANCHOR.x) ** 2 + (item.z - PADDY_ANCHOR.z) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = item;
    }
  }
  return best;
}

/**
 * A water buffalo standing in the paddy, the animal that is in every photograph
 * of the wet-zone lowlands. Unlike the elephant and the leopard it is always
 * there — it's livestock, not a sighting — so it's the one bit of wildlife you
 * can count on finding: it grazes with its head down, swings its tail, flicks an
 * ear, and lifts its head every so often to look around (useIdleMotion).
 *
 * Its position comes from the paddy scatter rather than a hand-placed
 * coordinate, so it always stands in an actual rice field; see pickPaddy.
 *
 * Clicking it lifts the head fully and snorts. Under prefers-reduced-motion it
 * simply stands there head-down.
 */
export function WaterBuffalo({ scatter, prefersReducedMotion }: { scatter: MapScatter; prefersReducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const earRefs = useRef<(THREE.Mesh | null)[]>([]);
  const { trigger, reacting, envelope } = useClickReaction(REACTION_DURATION);
  const idle = useIdleMotion({ speed: 0.6, minGap: 5, maxGap: 12, duration: 2.6 });

  const field = useMemo(() => pickPaddy(scatter.paddy), [scatter]);

  useFrame(({ clock }) => {
    const e = prefersReducedMotion ? null : envelope();
    const { t, breath, fidget, fidgetElapsed } = idle(clock.elapsedTime, !prefersReducedMotion);

    if (headRef.current) {
      // Head down in the crop, lifting for a look around on a fidget and coming
      // right up on a click.
      const lift = Math.max(fidget * 0.75, e ? e.strength : 0);
      headRef.current.rotation.x = GRAZE_X * (1 - lift);
      headRef.current.rotation.y =
        Math.sin(t * 0.5) * 0.12 + Math.sin(fidgetElapsed * 1.4) * 0.3 * fidget + (e ? Math.sin(e.elapsed * 5) * 0.2 * e.strength : 0);
    }

    // Ribs on the breath curve; a buffalo's barrel chest is most of its outline.
    if (bodyRef.current) bodyRef.current.scale.set(1 + breath * 0.04, 0.9 + breath * 0.035, 1.5);

    // The tail never stops: that's what a standing buffalo does about the flies.
    if (tailRef.current) {
      tailRef.current.rotation.z =
        Math.sin(t * 2.2) * 0.35 + Math.sin(t * 0.8) * 0.12 + (e ? Math.sin(e.elapsed * 9) * 0.4 * e.strength : 0);
    }

    for (let i = 0; i < earRefs.current.length; i++) {
      const ear = earRefs.current[i];
      if (!ear) continue;
      const side = i === 0 ? -1 : 1;
      ear.rotation.z = side * (1 + Math.sin(t * 1.7 + i * 2) * 0.18 + Math.sin(fidgetElapsed * 9) * 0.3 * fidget);
    }

    if (groupRef.current) {
      groupRef.current.rotation.z = prefersReducedMotion ? 0 : Math.sin(t * 0.7) * 0.012;
    }
  });

  return (
    <group
      ref={groupRef}
      // Sunk a hair into the field: a buffalo in a paddy stands in water and mud,
      // not on top of the terrace slab.
      position={[field.x, field.y - 0.012, field.z]}
      rotation={[0, field.rotationY + 0.4, 0]}
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
      <mesh ref={bodyRef} position={[0, 0.04, 0]} scale={[1, 0.9, 1.5]}>
        <sphereGeometry args={[0.036, 8, 6]} />
        <meshStandardMaterial color={HIDE_COLOR} roughness={0.95} flatShading />
      </mesh>

      {/* Shoulder hump, the giveaway of a buffalo rather than a cow. */}
      <mesh position={[0, 0.062, 0.012]} scale={[0.8, 0.5, 1]}>
        <sphereGeometry args={[0.022, 6, 5]} />
        <meshStandardMaterial color={HIDE_COLOR} roughness={0.95} flatShading />
      </mesh>

      {/* Head, horns and ears on one pivot at the neck, so grazing swings all of it. */}
      <group ref={headRef} position={[0, 0.05, 0.05]} rotation={[GRAZE_X, 0, 0]}>
        <mesh position={[0, -0.004, 0.018]} scale={[0.9, 0.8, 1.2]}>
          <sphereGeometry args={[0.02, 6, 5]} />
          <meshStandardMaterial color={HIDE_COLOR_DARK} roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, -0.012, 0.036]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.7]}>
          <coneGeometry args={[0.011, 0.016, 5]} />
          <meshStandardMaterial color={HIDE_COLOR_DARK} roughness={0.95} flatShading />
        </mesh>

        {/* Horns: swept out and back in a wide crescent, which is the whole silhouette at this size. */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.014, 0.008, 0.012]} rotation={[0.2, 0, side * 1.15]}>
            <mesh position={[0, 0.016, 0]} rotation={[0, 0, side * -0.5]}>
              <cylinderGeometry args={[0.0025, 0.005, 0.032, 5]} />
              <meshStandardMaterial color={HORN_COLOR} roughness={0.6} flatShading />
            </mesh>
          </group>
        ))}

        {[-1, 1].map((side, i) => (
          <mesh
            key={side}
            ref={(m) => {
              earRefs.current[i] = m;
            }}
            position={[side * 0.019, 0.001, 0.008]}
            rotation={[0, 0, side]}
            scale={[1, 0.5, 0.35]}
          >
            <sphereGeometry args={[0.011, 5, 4]} />
            <meshStandardMaterial color={HIDE_COLOR_DARK} roughness={0.95} flatShading />
          </mesh>
        ))}
      </group>

      {LEG_OFFSETS.map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.014, dz]}>
          <cylinderGeometry args={[0.008, 0.008, 0.028, 5]} />
          <meshStandardMaterial color={HIDE_COLOR_DARK} roughness={0.95} flatShading />
        </mesh>
      ))}

      <mesh ref={tailRef} position={[0, 0.05, -0.05]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.002, 0.034, 4]} />
        <meshStandardMaterial color={HIDE_COLOR_DARK} roughness={0.95} flatShading />
      </mesh>

      {reacting && (
        <Html position={[0, 0.1, 0.03]} center zIndexRange={CRITTER_HTML_Z}>
          <div className="marker-label-glass pointer-events-none whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream">
            Boehh 🐃
          </div>
        </Html>
      )}
    </group>
  );
}
