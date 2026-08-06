import { useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";

interface ReactionEnvelope {
  /** Seconds since the triggering click. */
  elapsed: number;
  /** 1 right after the click, decaying linearly to 0 over durationSeconds. */
  strength: number;
}

/**
 * Drives a critter's one-shot "reaction" animation (ear flap, tail flick,
 * spout...) from a single click. `envelope()` is a plain accessor (not
 * state) so a useFrame loop can read it every frame without triggering a
 * re-render; `reacting` is real state for the rarer, cheap re-render of a
 * fact bubble mounting/unmounting.
 */
export function useClickReaction(durationSeconds: number) {
  const { clock } = useThree();
  const [reacting, setReacting] = useState(false);
  const clickedAt = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    clickedAt.current = clock.getElapsedTime();
    setReacting(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setReacting(false), durationSeconds * 1000);
  }, [clock, durationSeconds]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const envelope = useCallback((): ReactionEnvelope | null => {
    if (clickedAt.current === null) return null;
    const elapsed = clock.getElapsedTime() - clickedAt.current;
    if (elapsed > durationSeconds) return null;
    return { elapsed, strength: 1 - elapsed / durationSeconds };
  }, [clock, durationSeconds]);

  return { trigger, reacting, envelope };
}
