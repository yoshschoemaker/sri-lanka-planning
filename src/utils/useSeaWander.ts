import { useCallback, useRef } from "react";

const TAU = Math.PI * 2;

export interface SeaWander {
  /** Offset from the anchor position along x (east), in world units. */
  dx: number;
  /** Offset from the anchor position along z (south), in world units. */
  dz: number;
  /** Rotation (radians around Y) that points a +z-facing model along its travel direction. */
  heading: number;
}

interface SeaWanderOptions {
  /** Half-width of the patrol, in world units (along the coast). */
  radiusX?: number;
  /** Half-depth of the patrol, in world units (towards/away from the coast). */
  radiusZ?: number;
  /** Multiplier on how fast the loop is traversed. */
  speed?: number;
}

const REST: SeaWander = { dx: 0, dz: 0, heading: 0 };

/** Seconds ahead the path is sampled to derive a heading. Long enough that the direction reads smoothly, short enough that it still points where the animal is actually going. */
const HEADING_LOOKAHEAD = 0.35;

/**
 * A closed figure-eight-ish path around the anchor point: x on the base
 * frequency, z on twice that, so the animal loops back on itself instead of
 * drifting off, and the two axes are never in phase (a circle would read as a
 * carousel). Deliberately not random-walk: the loop is bounded by
 * radiusX/radiusZ, which is what lets the placement in data/mapDecor.ts be
 * verified as offshore for the whole path rather than just the anchor.
 */
function pathAt(a: number, radiusX: number, radiusZ: number): { dx: number; dz: number } {
  return { dx: Math.sin(a) * radiusX, dz: Math.sin(a * 2) * radiusZ };
}

/**
 * Slow travel for the sea critters, so a turtle or whale you look at twice is
 * not pinned to the exact same square metre of ocean. Layers on top of
 * useIdleMotion (which animates the body in place) and useClickReaction: this
 * hook only moves the anchor and supplies a heading to face.
 *
 * Read it inside useFrame; nothing here is React state, so it never
 * re-renders. Pass enabled = false (reduced motion) to freeze at the anchor.
 */
export function useSeaWander({ radiusX = 0.3, radiusZ = 0.12, speed = 0.06 }: SeaWanderOptions = {}) {
  const phase = useRef(Math.random() * TAU);

  return useCallback(
    (elapsedTime: number, enabled = true): SeaWander => {
      if (!enabled) return REST;

      const a = elapsedTime * speed * TAU + phase.current;
      const here = pathAt(a, radiusX, radiusZ);
      const ahead = pathAt(a + HEADING_LOOKAHEAD * speed * TAU, radiusX, radiusZ);
      // atan2(dx, dz), not the usual (dz, dx): rotation.y = θ maps a model's
      // local +z onto (sin θ, cos θ), and these critters are all built nose-first
      // along +z.
      const heading = Math.atan2(ahead.dx - here.dx, ahead.dz - here.dz);

      return { dx: here.dx, dz: here.dz, heading };
    },
    [radiusX, radiusZ, speed],
  );
}
