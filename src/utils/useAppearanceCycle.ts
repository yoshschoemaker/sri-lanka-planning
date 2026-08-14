import { useCallback, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export interface AppearanceState {
  /** 0 at the very edges of the visible window, 1 in the middle. Drive opacity/scale with this. */
  fade: number;
  /** 0..1 through the visible window, regardless of fade. Drive a walk path with this. */
  progress: number;
}

interface AppearanceCycleOptions {
  /** How long one appearance lasts, in seconds. */
  visibleFor: number;
  /** Shortest gap between two appearances, in seconds. */
  minGap: number;
  /** Longest gap between two appearances, in seconds. */
  maxGap: number;
  /** Seconds of fade at each end of the visible window. Must be well under half of visibleFor. */
  fade?: number;
  /** Seconds before the first appearance, so several critters don't all arrive at once. */
  firstDelay?: number;
  /**
   * false pins the critter permanently on stage at `restProgress` and never
   * cycles it — what prefers-reduced-motion gets, since a thing that pops in
   * and out of the scene by itself is exactly the motion that setting is asking
   * us not to make.
   */
  enabled?: boolean;
  /** Where along the visible window the disabled/pinned state sits. */
  restProgress?: number;
}

/**
 * Makes a critter come and go instead of standing in the diorama forever: it
 * is off-stage most of the time, appears for `visibleFor` seconds, then leaves
 * again for a random gap. `visible` is React state (so the meshes actually
 * unmount while it's away, and so a fresh walk path can be picked per
 * appearance), `cycleId` bumps on every arrival, and `sample()` is a plain
 * accessor for the useFrame loop — no per-frame re-renders.
 *
 * Pairs with useIdleMotion (which handles the small "this thing is alive"
 * motion while it *is* on stage) and useClickReaction (one-shot reactions).
 */
export function useAppearanceCycle({
  visibleFor,
  minGap,
  maxGap,
  fade = 0.6,
  firstDelay = 0,
  enabled = true,
  restProgress = 0.5,
}: AppearanceCycleOptions) {
  const { clock } = useThree();
  const [state, setState] = useState(() => ({ visible: !enabled, cycleId: 0 }));
  const startedAt = useRef<number | null>(null);
  const nextAppearAt = useRef<number | null>(null);

  useFrame(() => {
    if (!enabled) return;
    const now = clock.elapsedTime;

    if (nextAppearAt.current === null) nextAppearAt.current = now + firstDelay;

    if (!state.visible) {
      if (now >= nextAppearAt.current) {
        startedAt.current = now;
        setState((s) => ({ visible: true, cycleId: s.cycleId + 1 }));
      }
      return;
    }

    if (startedAt.current !== null && now - startedAt.current >= visibleFor) {
      startedAt.current = null;
      nextAppearAt.current = now + minGap + Math.random() * (maxGap - minGap);
      setState((s) => ({ visible: false, cycleId: s.cycleId }));
    }
  });

  const sample = useCallback((): AppearanceState => {
    if (!enabled) return { fade: 1, progress: restProgress };
    if (startedAt.current === null) return { fade: 0, progress: 0 };
    const elapsed = clock.elapsedTime - startedAt.current;
    const progress = Math.min(1, Math.max(0, elapsed / visibleFor));
    // Ramp in, hold, ramp out — smoothstepped at both ends so nothing ever pops.
    const edge = Math.min(elapsed, visibleFor - elapsed) / fade;
    const f = Math.min(1, Math.max(0, edge));
    return { fade: f * f * (3 - 2 * f), progress };
  }, [clock, enabled, fade, restProgress, visibleFor]);

  return { visible: state.visible, cycleId: state.cycleId, sample };
}
