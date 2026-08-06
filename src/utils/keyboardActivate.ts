import type { KeyboardEvent } from "react";

/**
 * Enter/Space activates a custom role="button" element, mirroring native
 * button semantics. The same inline check appears twice in TripMap.tsx (2D);
 * pulled out here since the 3D markers add a third and fourth copy.
 */
export function handleActivateKey(e: KeyboardEvent, onActivate: () => void): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onActivate();
  }
}
