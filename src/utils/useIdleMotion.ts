import { useCallback, useRef } from "react";

const TAU = Math.PI * 2;

export interface IdleMotion {
  /** Per-instance time in seconds, offset so critters never move in lockstep. */
  t: number;
  /** Smooth -1..1 breathing curve at this critter's own tempo. */
  breath: number;
  /** 0 while resting, easing up to 1 and back to 0 during an occasional fidget. */
  fidget: number;
  /** Seconds since the current fidget started, 0 while resting. Use for fast wobbles inside a fidget. */
  fidgetElapsed: number;
}

interface IdleMotionOptions {
  /** Multiplier on the breathing tempo. */
  speed?: number;
  /** Shortest gap between two fidgets, in seconds. */
  minGap?: number;
  /** Longest gap between two fidgets, in seconds. */
  maxGap?: number;
  /** How long one fidget lasts, in seconds. */
  duration?: number;
}

const REST: IdleMotion = { t: 0, breath: 0, fidget: 0, fidgetElapsed: 0 };

/**
 * Ambient "this thing is alive" motion for the diorama critters: a constant
 * gentle breathing curve plus a fidget that fires by itself at random
 * intervals, so an animal you are not touching still twitches an ear or
 * swishes a tail once in a while. Read it inside useFrame; nothing here is
 * React state, so it never re-renders. One-shot click reactions
 * (useClickReaction) layer on top of this.
 */
export function useIdleMotion({ speed = 1, minGap = 6, maxGap = 14, duration = 1.6 }: IdleMotionOptions = {}) {
  const phase = useRef(Math.random() * TAU);
  const nextFidgetAt = useRef<number | null>(null);
  const fidgetStartedAt = useRef<number | null>(null);

  return useCallback(
    (elapsedTime: number, enabled = true): IdleMotion => {
      if (!enabled) return REST;

      if (nextFidgetAt.current === null) {
        nextFidgetAt.current = elapsedTime + minGap + Math.random() * (maxGap - minGap);
      }
      if (fidgetStartedAt.current === null && elapsedTime >= nextFidgetAt.current) {
        fidgetStartedAt.current = elapsedTime;
      }

      let fidget = 0;
      let fidgetElapsed = 0;
      if (fidgetStartedAt.current !== null) {
        fidgetElapsed = elapsedTime - fidgetStartedAt.current;
        if (fidgetElapsed >= duration) {
          fidgetStartedAt.current = null;
          fidgetElapsed = 0;
          nextFidgetAt.current = elapsedTime + minGap + Math.random() * (maxGap - minGap);
        } else {
          // 0 -> 1 -> 0, so the pose always starts and ends exactly at rest.
          fidget = Math.sin((fidgetElapsed / duration) * Math.PI);
        }
      }

      const t = elapsedTime * speed + phase.current;
      return { t, breath: Math.sin(t), fidget, fidgetElapsed };
    },
    [speed, minGap, maxGap, duration],
  );
}
