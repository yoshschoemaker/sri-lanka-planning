import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { CameraControls, type CameraControlsImpl } from "@react-three/drei";
import type { Stop } from "../../types/trip";
import { getMarkerWorldPosition } from "../../utils/mapLayout3d";
import { ISLAND_TOP_Y } from "./Island";

/**
 * Bounds derived from (and centered near) TripMap3D's existing fixed camera
 * position [5.7, 11.6, 16.2] looking at the origin: that position sits at
 * azimuth ~19.4°/polar ~56° (three.js's own Spherical convention, which
 * camera-controls reuses directly), so these defaults keep the first paint
 * effectively identical to the already-approved Phase 1 static shot while
 * still letting the user tilt/rotate a bit either side of it.
 */
const MIN_POLAR_DEG = 35;
const MAX_POLAR_DEG = 75;
const DEFAULT_POLAR_DEG = 52;
const MIN_AZIMUTH_DEG = -20;
const MAX_AZIMUTH_DEG = 60;
const DEFAULT_AZIMUTH_DEG = 20;

/**
 * Matches the fixed camera's actual distance from the origin (sqrt(5.7² +
 * 11.6² + 16.2²) = 20.72), scaled down by ~1.12x so the island fills more of
 * the panel instead of floating in a sea of empty water. Min/max scale by
 * the same factor, so "zoomed all the way out" still reads as "a bit zoomed
 * in" rather than reverting to the original sparse framing.
 */
const ZOOM_IN_FACTOR = 1.2;
const DEFAULT_DISTANCE = 20.72 / ZOOM_IN_FACTOR;
const MIN_DISTANCE = 14 / ZOOM_IN_FACTOR;
const MAX_DISTANCE = 28 / ZOOM_IN_FACTOR;

/**
 * The island's world-space bounding box is centered near (0, 0), but at this
 * azimuth/polar the *rendered* silhouette isn't: the oblique angle bunches
 * empty water on the left of frame while the eastern coastline (near stops
 * 2/3) grazes the right edge. Panning the look-at target here (rather than
 * touching azimuth/polar, which would change the already-tuned diorama
 * angle) re-centers the silhouette so the whole island has even margin on
 * every side.
 */
const OVERVIEW_TARGET = { x: 0.33, z: -0.12 };

function sphericalOffset(distance: number, polarRad: number, azimuthRad: number): THREE.Vector3 {
  const horizontal = distance * Math.sin(polarRad);
  return new THREE.Vector3(horizontal * Math.sin(azimuthRad), distance * Math.cos(polarRad), horizontal * Math.cos(azimuthRad));
}

const DEFAULT_OFFSET = sphericalOffset(
  DEFAULT_DISTANCE,
  THREE.MathUtils.degToRad(DEFAULT_POLAR_DEG),
  THREE.MathUtils.degToRad(DEFAULT_AZIMUTH_DEG),
);

export interface CameraRigHandle {
  /** Flies back to the default whole-island overview, regardless of the current selection. */
  resetView: () => void;
}

interface CameraRigProps {
  stops: Stop[];
  selected: string | null;
  prefersReducedMotion: boolean;
  ref?: React.Ref<CameraRigHandle>;
}

/**
 * Owns the CameraControls instance and flies to the selected stop. Bounded
 * polar/azimuth let the user gently tilt/rotate without ever flipping the
 * island on its side or upside down. On selection the camera always
 * recomputes from the same fixed angle/distance (DEFAULT_OFFSET), just
 * re-centered on the new stop, rather than preserving whatever angle the
 * user last dragged to, so every stop arrives at a consistent framing.
 * Also exposes an imperative `resetView` (React 19's ref-as-prop, no
 * forwardRef needed) so a plain HTML button outside the Canvas can recenter
 * the camera without threading camera state through props.
 */
export function CameraRig({ stops, selected, prefersReducedMotion, ref }: CameraRigProps) {
  const controlsRef = useRef<CameraControlsImpl>(null);

  const flyTo = useCallback((x: number, z: number, animate: boolean) => {
    controlsRef.current?.setLookAt(
      x + DEFAULT_OFFSET.x,
      ISLAND_TOP_Y + DEFAULT_OFFSET.y,
      z + DEFAULT_OFFSET.z,
      x,
      ISLAND_TOP_Y,
      z,
      animate,
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({ resetView: () => flyTo(OVERVIEW_TARGET.x, OVERVIEW_TARGET.z, !prefersReducedMotion) }),
    [flyTo, prefersReducedMotion],
  );

  // Mount-only: lands on the re-centered overview framing immediately,
  // rather than the un-panned origin-target camera-controls assumes by
  // default from the Canvas's initial position.
  useEffect(() => {
    flyTo(OVERVIEW_TARGET.x, OVERVIEW_TARGET.z, false);
  }, [flyTo]);

  useEffect(() => {
    if (!selected) return;
    const stop = stops.find((s) => s.id === selected);
    if (!stop) return;

    const { x, z } = getMarkerWorldPosition(stop);
    flyTo(x, z, !prefersReducedMotion);
  }, [selected, stops, prefersReducedMotion, flyTo]);

  return (
    <CameraControls
      ref={controlsRef}
      minPolarAngle={THREE.MathUtils.degToRad(MIN_POLAR_DEG)}
      maxPolarAngle={THREE.MathUtils.degToRad(MAX_POLAR_DEG)}
      minAzimuthAngle={THREE.MathUtils.degToRad(MIN_AZIMUTH_DEG)}
      maxAzimuthAngle={THREE.MathUtils.degToRad(MAX_AZIMUTH_DEG)}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
    />
  );
}
