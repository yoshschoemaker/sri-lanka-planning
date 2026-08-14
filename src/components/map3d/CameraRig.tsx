import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import type { Stop } from "../../types/trip";
import { getMarkerWorldPosition } from "../../utils/mapLayout3d";
import { isStopover } from "../../utils/nights";
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
/**
 * Low enough to see the coast in profile — the whole point of giving the island
 * a beach shelf, which from directly overhead is only a band of colour. Not
 * pushed further: past this the top of the frame clears the horizon far enough
 * that the sea starts to look like a wall, and the shot stops reading as a
 * diorama on a table.
 */
const MAX_POLAR_DEG = 80;
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
/**
 * Low enough to get right down onto a single stop and its surroundings (roughly
 * a third of the default framing) instead of stopping at "one region of the
 * island". Kept above the Canvas's near plane of 1 plus the camera's own height
 * over ISLAND_TOP_Y at MIN_POLAR_DEG, so even the closest allowed shot never
 * clips into the terrain.
 */
const MIN_DISTANCE = 6 / ZOOM_IN_FACTOR;
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

/**
 * Focusing a stop looks at a point *between* that stop and the overview
 * center instead of straight at the stop. Targeting a coastal stop dead-on
 * (Negombo at world x ≈ -2.05, Yala at z ≈ 3.35, against an island spanning
 * only x ∈ [-2.4, 2.5], z ∈ [-4.3, 4.3]) shoves half the silhouette out of
 * frame and fills the rest with empty water. Pulling the target back toward
 * the middle keeps the island as fully in view as possible while the selected
 * stop still sits clearly off-center in the direction it actually lies.
 * x is biased harder than z because the panel is portrait: horizontal frame
 * is the scarce axis, and the island's long axis runs roughly vertical.
 */
const FOCUS_CENTER_BIAS = { x: 0.65, z: 0.5 };

/** Blends a stop's world position toward OVERVIEW_TARGET by FOCUS_CENTER_BIAS. Passing OVERVIEW_TARGET itself is a no-op, so the overview framing is unaffected. */
function focusTarget(x: number, z: number): { x: number; z: number } {
  return {
    x: THREE.MathUtils.lerp(x, OVERVIEW_TARGET.x, FOCUS_CENTER_BIAS.x),
    z: THREE.MathUtils.lerp(z, OVERVIEW_TARGET.z, FOCUS_CENTER_BIAS.z),
  };
}

/** World units per zoom-button click; ~1/6th of the full min-max distance range, so a few clicks visibly change the framing without a single click jumping too far. */
const ZOOM_STEP = (MAX_DISTANCE - MIN_DISTANCE) / 6;

/**
 * How long each simulated day dwells before advancing — matches TripMap3D's
 * DayNightLights CYCLE_DURATION (2.6s) exactly, so one dwell = one full
 * day/night sweep. Keep the two in sync if either changes.
 */
const DAY_DWELL_MS = 2600;

function sphericalOffset(distance: number, polarRad: number, azimuthRad: number): THREE.Vector3 {
  const horizontal = distance * Math.sin(polarRad);
  return new THREE.Vector3(horizontal * Math.sin(azimuthRad), distance * Math.cos(polarRad), horizontal * Math.cos(azimuthRad));
}

const DEFAULT_OFFSET = sphericalOffset(
  DEFAULT_DISTANCE,
  THREE.MathUtils.degToRad(DEFAULT_POLAR_DEG),
  THREE.MathUtils.degToRad(DEFAULT_AZIMUTH_DEG),
);

/** Noticeably closer than DEFAULT_OFFSET: the tour is a cinematic per-stop close-up, not the same "whole neighborhood" framing a manual stop click uses. Deliberately its own fraction of DEFAULT_DISTANCE rather than MIN_DISTANCE, so raising how far the user may manually zoom in doesn't drag the tour's framing along with it. */
const TOUR_DISTANCE = Math.max(MIN_DISTANCE, DEFAULT_DISTANCE * 0.68);
const TOUR_OFFSET = sphericalOffset(
  TOUR_DISTANCE,
  THREE.MathUtils.degToRad(DEFAULT_POLAR_DEG),
  THREE.MathUtils.degToRad(DEFAULT_AZIMUTH_DEG),
);

export interface CameraRigHandle {
  /** Flies back to the default whole-island overview, regardless of the current selection. */
  resetView: () => void;
  /** Dollies the camera closer/further; clamped to MIN_DISTANCE/MAX_DISTANCE by CameraControls itself. */
  zoomIn: () => void;
  zoomOut: () => void;
  /**
   * Free-form dolly in world units, for continuous input (trackpad pinch,
   * ctrl/⌘+scroll) rather than the fixed steps of the zoom buttons. Never
   * animated: the gesture itself is the animation, and easing every event
   * would lag a frame or two behind the fingers.
   */
  dollyBy: (amount: number) => void;
  /** Flies through every stop in order, dwelling one simulated day per night of the stay, then returns to the overview. No-op while already touring. */
  playTour: () => Promise<void>;
}

interface CameraRigProps {
  stops: Stop[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Fires once per simulated day (so a 2-night stop fires twice, camera staying put), with a running day count across the whole trip. */
  onTourDay: (stop: Stop, day: number) => void;
  /** Fires once per leg, right as the camera starts flying from one stop to the next (never for the very first stop, which has no prior stop to depart from). */
  onTourTransit: (from: Stop, to: Stop) => void;
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
export function CameraRig({ stops, selected, onSelect, onTourDay, onTourTransit, prefersReducedMotion, ref }: CameraRigProps) {
  const controlsRef = useRef<CameraControlsImpl>(null);
  /** Guards against overlapping tours (double-click, or a click mid-flight) rather than queuing a second pass. */
  const touringRef = useRef(false);

  const flyTo = useCallback((x: number, z: number, animate: boolean, offset: THREE.Vector3 = DEFAULT_OFFSET) => {
    const target = focusTarget(x, z);
    return controlsRef.current?.setLookAt(
      target.x + offset.x,
      ISLAND_TOP_Y + offset.y,
      target.z + offset.z,
      target.x,
      ISLAND_TOP_Y,
      target.z,
      animate,
    );
  }, []);

  const playTour = useCallback(async () => {
    if (touringRef.current) return;
    touringRef.current = true;
    try {
      let day = 1;
      let prevStop: Stop | null = null;
      for (const stop of stops) {
        const { x, z } = getMarkerWorldPosition(stop);

        // En route: the vehicle/"onderweg" indicator plays while the camera is
        // still actually traveling there, so the destination only switches on
        // arrival instead of jumping the instant the leg starts.
        if (prevStop) onTourTransit(prevStop, stop);
        await flyTo(x, z, !prefersReducedMotion, TOUR_OFFSET);
        onSelect(stop.id);

        // The camera only flies once per stop; a multi-night stay dwells here
        // for one tick per night instead, so "2 nights" visibly reads as two
        // separate day/night cycles at the same place rather than one.
        // A stopover (0 nights) still dwells one tick so the tour visibly stops
        // there, but it shares its calendar day with the next stop's arrival, so
        // the day counter stays put.
        const dwellTicks = Math.max(1, stop.nights);
        for (let n = 0; n < dwellTicks; n++) {
          onTourDay(stop, day);
          if (!isStopover(stop)) day++;
          await new Promise((resolve) => setTimeout(resolve, DAY_DWELL_MS));
        }
        prevStop = stop;
      }
      await flyTo(OVERVIEW_TARGET.x, OVERVIEW_TARGET.z, !prefersReducedMotion);
    } finally {
      touringRef.current = false;
    }
  }, [stops, onSelect, onTourDay, onTourTransit, prefersReducedMotion, flyTo]);

  useImperativeHandle(
    ref,
    () => ({
      resetView: () => flyTo(OVERVIEW_TARGET.x, OVERVIEW_TARGET.z, !prefersReducedMotion),
      zoomIn: () => controlsRef.current?.dolly(ZOOM_STEP, !prefersReducedMotion),
      zoomOut: () => controlsRef.current?.dolly(-ZOOM_STEP, !prefersReducedMotion),
      dollyBy: (amount: number) => controlsRef.current?.dolly(amount, false),
      playTour,
    }),
    [flyTo, playTour, prefersReducedMotion],
  );

  /*
   * Het muiswiel stuurt de camera níét. De kaart staat midden in een lange
   * pagina, dus een gewone twee-vinger-scroll erboven hoort de pagina te
   * scrollen in plaats van stiekem in te zoomen. Zoomen loopt via de knoppen
   * en via pinch/⌘+scroll, die TripMap3D zelf afvangt: die vangt het ook af
   * boven de DOM-overlays (badges, knoppen), waar camera-controls' eigen
   * wheel-listener op de canvas nooit bij komt en de browser dus de hele site
   * ging vergroten.
   */
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.mouseButtons.wheel = CameraControlsImpl.ACTION.NONE;
  }, []);

  // Mount-only: lands on the re-centered overview framing immediately,
  // rather than the un-panned origin-target camera-controls assumes by
  // default from the Canvas's initial position.
  useEffect(() => {
    flyTo(OVERVIEW_TARGET.x, OVERVIEW_TARGET.z, false);
  }, [flyTo]);

  useEffect(() => {
    // While touring, playTour already drives flyTo itself for every stop in
    // sequence; without this guard, its own onSelect(stop.id) call would make
    // this effect fire a second, redundant setLookAt to the same target on
    // every stop and restart the in-flight transition's easing.
    if (!selected || touringRef.current) return;
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
