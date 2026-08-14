import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ISLAND_BOUNDS } from "../../utils/geometry3d";
import { useAppearanceCycle } from "../../utils/useAppearanceCycle";
import { useDetailLevel } from "../../utils/useDetailLevel";
import { ISLAND_TOP_Y } from "./Island";

const TAU = Math.PI * 2;

/** Near-silhouette, the way birds this far up actually read against a bright sky. */
const BIRD_COLOR = "#4a4740";

const CENTER = {
  x: (ISLAND_BOUNDS.minX + ISLAND_BOUNDS.maxX) / 2,
  z: (ISLAND_BOUNDS.minZ + ISLAND_BOUNDS.maxZ) / 2,
};
/** Where a flock enters and leaves: outside the coastline, inside the camera's default framing. */
const APPROACH_RADIUS = 3.6;
/** Cruising height above the island's surface. Clears the highlands' top tier and the tallest props by a wide margin. */
const CRUISE_Y = ISLAND_TOP_Y + 1.3;

/** How long one flyover lasts, and the range of seconds of empty sky in between. */
const VISIBLE_FOR = 24;
const MIN_GAP = 16;
const MAX_GAP = 40;

/** Rough length of one crossing in world units, used to turn 0..1 progress into distance flown. */
const CROSSING_LENGTH = APPROACH_RADIUS * 2;
/** Radians of wingbeat per world unit flown. At the cruise speed above this lands near 4 beats/second. */
const FLAP_RATE = 84;

interface FlightPath {
  pointAt(t: number): { x: number; y: number; z: number };
  headingAt(t: number): number;
}

/**
 * One crossing of the island: in over the coast on one side, out over the other,
 * bowed sideways so the flock curves across rather than ruling a straight line,
 * and highest over the middle of the crossing.
 */
function createFlightPath(): FlightPath {
  const entry = Math.random() * TAU;
  // Roughly opposite, but never exactly — an exactly-opposite exit reads as a machine.
  const exit = entry + Math.PI + (Math.random() - 0.5) * 1.4;
  const bow = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.9);
  const climb = 0.18 + Math.random() * 0.3;

  const start = { x: CENTER.x + Math.sin(entry) * APPROACH_RADIUS, z: CENTER.z + Math.cos(entry) * APPROACH_RADIUS };
  const end = { x: CENTER.x + Math.sin(exit) * APPROACH_RADIUS, z: CENTER.z + Math.cos(exit) * APPROACH_RADIUS };
  // Control point pushed perpendicular to the crossing, which is what bows it.
  const mid = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const len = Math.hypot(dx, dz) || 1;
  const control = { x: mid.x + (dz / len) * bow, z: mid.z - (dx / len) * bow };

  return {
    pointAt: (t) => {
      const u = 1 - t;
      return {
        x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
        y: CRUISE_Y + Math.sin(t * Math.PI) * climb,
        z: u * u * start.z + 2 * u * t * control.z + t * t * end.z,
      };
    },
    headingAt: (t) => {
      const u = 1 - t;
      const tx = 2 * u * (control.x - start.x) + 2 * t * (end.x - control.x);
      const tz = 2 * u * (control.z - start.z) + 2 * t * (end.z - control.z);
      return Math.atan2(tx, tz);
    },
  };
}

/**
 * A flock of small birds crossing the island overhead: they come in over one
 * coast, cross on a curved path with the whole formation banking into the turn,
 * and leave over the other side, after which the sky is empty for a while until
 * the next flock arrives on a different heading (useAppearanceCycle). Wings beat
 * in proportion to distance flown and drop into a glide now and then, staggered
 * per bird so the flock never flaps in lockstep.
 *
 * Deliberately the one bit of wildlife that is *not* clickable: at this size and
 * speed they'd be a frustrating hit target, and their job is ambience, not
 * interaction. Under prefers-reduced-motion the flock is left out entirely,
 * since a flock parked motionless in mid-air is worse than no flock.
 */
export function Birds({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const detail = useDetailLevel();
  const count = detail === "high" ? 8 : 5;

  const birdRefs = useRef<(THREE.Group | null)[]>([]);
  /** Two entries per bird (left wing, right wing), flat so one loop drives them all. */
  const wingRefs = useRef<(THREE.Group | null)[]>([]);

  const { visible, cycleId, sample } = useAppearanceCycle({
    visibleFor: VISIBLE_FOR,
    minGap: MIN_GAP,
    maxGap: MAX_GAP,
    fade: 2.5,
    firstDelay: 9,
    enabled: !prefersReducedMotion,
  });

  // cycleId is the re-roll key: every flock crosses on its own heading.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flight = useMemo(() => createFlightPath(), [cycleId]);
  /** Per-bird formation slot and flap offset, fixed for the app's lifetime. */
  const slots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        // Odd birds to the left, even to the right, each row a little further back: a loose V.
        lateral: (i % 2 === 0 ? 1 : -1) * (0.07 + Math.floor(i / 2) * 0.055),
        trail: Math.floor((i + 1) / 2) * 0.016,
        bobPhase: Math.random() * TAU,
        flapOffset: Math.random() * TAU,
        size: 0.85 + Math.random() * 0.3,
      })),
    [count],
  );

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: BIRD_COLOR, roughness: 0.9, flatShading: true, transparent: true }),
    [],
  );

  const flownRef = useRef(0);
  const prevT = useRef(0);

  useFrame(({ clock }) => {
    if (prefersReducedMotion) return;
    const { fade, progress } = sample();
    material.opacity = fade * 0.92;

    // Distance flown drives the wingbeat, so the flap rate matches the speed
    // rather than the frame rate.
    flownRef.current += Math.abs(progress - prevT.current) * CROSSING_LENGTH;
    prevT.current = progress;
    const flown = flownRef.current;
    const t = clock.elapsedTime;

    for (let i = 0; i < birdRefs.current.length; i++) {
      const bird = birdRefs.current[i];
      const slot = slots[i];
      if (!bird || !slot) continue;

      const bt = Math.min(1, Math.max(0, progress - slot.trail));
      const p = flight.pointAt(bt);
      const heading = flight.headingAt(bt);
      // Formation offset is perpendicular to the bird's own heading, so the V holds through the turn.
      const ox = Math.cos(heading) * slot.lateral;
      const oz = -Math.sin(heading) * slot.lateral;
      bird.position.set(ox + p.x, p.y + Math.sin(t * 1.3 + slot.bobPhase) * 0.035, oz + p.z);
      bird.rotation.y = heading;
      // Bank into the curve: how much the heading is about to change, damped.
      const turn = flight.headingAt(Math.min(1, bt + 0.03)) - heading;
      bird.rotation.z = Math.max(-0.5, Math.min(0.5, turn * 4));
      // Nose slightly down on the descent out of the arc, up on the climb in.
      bird.rotation.x = -Math.cos(bt * Math.PI) * 0.12;

      const wingBase = i * 2;
      // Every bird glides on its own schedule; mid-glide the wings just hold their dihedral.
      const glide = Math.max(0, Math.sin(t * 0.31 + slot.flapOffset)) ** 3;
      const beat = Math.sin(flown * FLAP_RATE + slot.flapOffset) * (1 - glide * 0.9);
      for (let side = 0; side < 2; side++) {
        const wing = wingRefs.current[wingBase + side];
        if (!wing) continue;
        const dir = side === 0 ? 1 : -1;
        wing.rotation.z = dir * (0.2 + beat * 0.75);
      }
    }
  });

  // No flock at all under reduced motion: a formation frozen in mid-air over the
  // island would be stranger than an empty sky.
  if (prefersReducedMotion || !visible) return null;

  return (
    <group>
      {slots.map((slot, i) => (
        <group
          key={i}
          ref={(g) => {
            birdRefs.current[i] = g;
          }}
          position={[CENTER.x, CRUISE_Y, CENTER.z]}
          scale={slot.size}
        >
          <mesh scale={[0.55, 0.5, 1.7]} material={material}>
            <sphereGeometry args={[0.022, 5, 4]} />
          </mesh>
          {/* Tail, and the only thing giving the silhouette a front and a back at this size. */}
          <mesh position={[0, 0.002, -0.042]} rotation={[Math.PI / 2, 0, 0]} scale={[0.7, 1, 0.25]} material={material}>
            <coneGeometry args={[0.014, 0.03, 3]} />
          </mesh>
          {[0, 1].map((side) => (
            <group
              key={side}
              ref={(g) => {
                wingRefs.current[i * 2 + side] = g;
              }}
              position={[side === 0 ? 0.008 : -0.008, 0.004, 0]}
            >
              {/* Swept back from the shoulder, so a flap sweeps the whole wing rather than spinning a plank. */}
              <mesh
                position={[side === 0 ? 0.05 : -0.05, 0, -0.008]}
                rotation={[0, 0, side === 0 ? -0.25 : 0.25]}
                scale={[1, 0.14, 1]}
                material={material}
              >
                <boxGeometry args={[0.1, 0.02, 0.032]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
