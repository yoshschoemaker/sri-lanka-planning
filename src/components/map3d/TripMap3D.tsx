import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Sparkles } from "@react-three/drei";
import type { Stop, TransportMode, TransportModeKey } from "../../types/trip";
import type { ModeFilter, StatusFilter } from "../FilterBar";
import {
  ELEPHANT_POSITION,
  FISH_SCHOOL_POSITION,
  GALLE_FORT_POSITION,
  LEOPARD_POSITION,
  NINE_ARCHES_POSITION,
  NINE_ARCHES_ROTATION,
  PALM_TREE_POSITIONS,
  SIGIRIYA_ROCK_POSITION,
  STUPA_POSITION,
  TEMPLE_POSITIONS,
  TURTLE_POSITION,
  WATERFALL_POSITION,
  WATERFALL_ROTATION,
  WAVE_CREST_POSITIONS,
  WHALE_POSITION,
} from "../../data/mapDecor";
import { getDaytripEntries } from "../../utils/daytrips";
import { getMarkerWorldPosition } from "../../utils/mapLayout3d";
import { isBookingSettled } from "../../utils/nights";
import { projectToWorld } from "../../utils/projection3d";
import { useMapScatter } from "../../utils/useMapScatter";
import { useReducedMotion } from "../../utils/useReducedMotion";
import { Island } from "./Island";
import { Water } from "./Water";
import { CameraRig, type CameraRigHandle } from "./CameraRig";
import { StopMarker3D } from "./StopMarker3D";
import { DaytripMarker3D } from "./DaytripMarker3D";
import { RouteLine3D } from "./RouteLine3D";
import { DaytripConnector3D } from "./DaytripConnector3D";
import { PalmTree } from "./PalmTree";
import { WaveCrest } from "./WaveCrest";
import { Highlands, PLATEAU_LAYER1_TOP, getPlateauCenter, getTerrainSurfaceY } from "./Highlands";
import { Stupa } from "./Stupa";
import { TeaBushes } from "./TeaBushes";
import { Leopard } from "./Leopard";
import { Elephant } from "./Elephant";
import { Train3D } from "./Train3D";
import { Temple } from "./Temple";
import { FishSchool } from "./FishSchool";
import { Turtle } from "./Turtle";
import { Whale } from "./Whale";
import { SigiriyaRock } from "./SigiriyaRock";
import { Rain3D } from "./Rain3D";
import { RoadVehicle3D } from "./RoadVehicle3D";
import { Vegetation } from "./Vegetation";
import { Boulders } from "./Boulders";
import { PaddyFields } from "./PaddyFields";
import { InlandWater } from "./InlandWater";
import { NineArchesBridge } from "./NineArchesBridge";
import { GalleFort } from "./GalleFort";
import { Waterfall } from "./Waterfall";

function RecenterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function ZoomIcon({ className, mode }: { className?: string; mode: "in" | "out" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
      {mode === "in" && <path d="M11 8v6M8 11h6" />}
      {mode === "out" && <path d="M8 11h6" />}
    </svg>
  );
}

function TourIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 17c2-5 4-3 6-8s4-3 6-8" transform="translate(0 5)" />
      <path d="M17 6l3 .5-1 3" />
    </svg>
  );
}

function EveningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

/** Shared visual chrome for every floating circular map button, so recenter/zoom/tour stay one consistent toolbar. */
/* z-10 hoort hier bij: de drei-<Html>-markers portalen naast de canvas in
   dezelfde wrapper, dus zonder eigen z-index verliest een knop van de badges.
   Zie htmlLayers.ts, dat de markers onder deze 10 houdt. */
const MAP_BUTTON_CLASS =
  "z-10 flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white/90 text-ink shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-white active:scale-95 disabled:pointer-events-none disabled:opacity-50";

const DAY_LIGHTS = {
  hemiSky: new THREE.Color("#fff1dd"),
  hemiGround: new THREE.Color("#3a2a1d"),
  hemiIntensity: 0.75,
  key: new THREE.Color("#ffddb3"),
  keyIntensity: 1.7,
  fill: new THREE.Color("#bfe3ff"),
  fillIntensity: 0.35,
  ambient: 0.18,
};

/** Deep dusk, not pitch black: the diorama should still read at a glance, just moodier. */
const NIGHT_LIGHTS = {
  hemiSky: new THREE.Color("#3c4a70"),
  hemiGround: new THREE.Color("#0d0f1a"),
  hemiIntensity: 0.32,
  key: new THREE.Color("#93a8de"),
  keyIntensity: 0.5,
  fill: new THREE.Color("#28345c"),
  fillIntensity: 0.22,
  ambient: 0.07,
};

const LIGHT_LAMBDA = 3;

/**
 * One simulated day/night cycle while touring, in seconds — matches
 * CameraRig's DAY_DWELL_MS (2600ms) exactly, so the cycle completes right as
 * the tour advances to the next day. Keep the two in sync if either changes.
 */
const CYCLE_DURATION = 2.6;
/** Day runs a bit longer than night, per feedback ("maak dag iets langer dan nacht"). */
const DAY_FRACTION = 0.62;
const DAY_CENTER = DAY_FRACTION / 2;
const NIGHT_CENTER = DAY_FRACTION + (1 - DAY_FRACTION) / 2;

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Shortest distance between two points on a [0,1) cycle (wrapping across the 1→0 seam). */
function wrappedDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

/**
 * 0 = full day, 1 = full night, for a point in the [0,1) cycle. Blends by
 * relative distance to the day/night centers (placed according to
 * DAY_FRACTION) rather than piecewise boundaries, so it's wrap-safe at the
 * 1→0 seam and needs no separate easing pass — the smoothstep below already
 * gives it an S-curve instead of a sharp linear crossover.
 */
function nightBlendFromPhase(phase: number): number {
  const toDay = wrappedDistance(phase, DAY_CENTER);
  const toNight = wrappedDistance(phase, NIGHT_CENTER);
  return smoothstep01(toDay / (toDay + toNight));
}

/**
 * Damps every scene light (and, via `nightAmountRef`, Water's sea shader)
 * between DAY_LIGHTS and NIGHT_LIGHTS. Two independent drivers, matching
 * whichever is active: the manual evening toggle when browsing normally, or
 * — while touring — a continuous day/night cycle advanced here from
 * `cyclePhaseRef`, which CameraRig's onTourDay callback resets to 0 at the
 * start of every simulated day.
 */
function DayNightLights({
  touring,
  manualEvening,
  cyclePhaseRef,
  nightAmountRef,
  prefersReducedMotion,
}: {
  touring: boolean;
  manualEvening: boolean;
  cyclePhaseRef: RefObject<number>;
  nightAmountRef: RefObject<number>;
  prefersReducedMotion: boolean;
}) {
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  useFrame((_state, delta) => {
    if (touring && !prefersReducedMotion) {
      cyclePhaseRef.current = (cyclePhaseRef.current + delta / CYCLE_DURATION) % 1;
    }
    const nightAmount = touring ? nightBlendFromPhase(cyclePhaseRef.current) : manualEvening ? 1 : 0;
    nightAmountRef.current = prefersReducedMotion
      ? nightAmount
      : THREE.MathUtils.damp(nightAmountRef.current, nightAmount, LIGHT_LAMBDA, delta);
    const t = nightAmountRef.current;

    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(DAY_LIGHTS.hemiSky).lerp(NIGHT_LIGHTS.hemiSky, t);
      hemi.groundColor.copy(DAY_LIGHTS.hemiGround).lerp(NIGHT_LIGHTS.hemiGround, t);
      hemi.intensity = THREE.MathUtils.lerp(DAY_LIGHTS.hemiIntensity, NIGHT_LIGHTS.hemiIntensity, t);
    }
    const key = keyRef.current;
    if (key) {
      key.color.copy(DAY_LIGHTS.key).lerp(NIGHT_LIGHTS.key, t);
      key.intensity = THREE.MathUtils.lerp(DAY_LIGHTS.keyIntensity, NIGHT_LIGHTS.keyIntensity, t);
    }
    const fill = fillRef.current;
    if (fill) {
      fill.color.copy(DAY_LIGHTS.fill).lerp(NIGHT_LIGHTS.fill, t);
      fill.intensity = THREE.MathUtils.lerp(DAY_LIGHTS.fillIntensity, NIGHT_LIGHTS.fillIntensity, t);
    }
    const ambient = ambientRef.current;
    if (ambient) ambient.intensity = THREE.MathUtils.lerp(DAY_LIGHTS.ambient, NIGHT_LIGHTS.ambient, t);
  });

  return (
    <>
      {/* `flat` (NoToneMapping) keeps the flat-shaded diorama's colors as vivid as authored; ACES's default filmic
          curve was quietly crushing the water's blues toward navy. */}
      <hemisphereLight ref={hemiRef} args={[DAY_LIGHTS.hemiSky, DAY_LIGHTS.hemiGround, DAY_LIGHTS.hemiIntensity]} />
      <directionalLight ref={keyRef} position={[4.5, 7, 3]} intensity={DAY_LIGHTS.keyIntensity} color={DAY_LIGHTS.key} />
      {/* Cool rim/fill from the opposite side, low enough to stay a fill light rather than a second key. */}
      <directionalLight ref={fillRef} position={[-5, 4, -4]} intensity={DAY_LIGHTS.fillIntensity} color={DAY_LIGHTS.fill} />
      <ambientLight ref={ambientRef} intensity={DAY_LIGHTS.ambient} />
    </>
  );
}

/**
 * Small analog clock badge shown next to the day counter while touring: the
 * conic-gradient track shows day (light arc) vs night (dark arc) at their
 * real proportions, and the hand sweeps once per simulated day. Reads
 * `cyclePhaseRef` via its own rAF loop (mutating the hand's transform
 * directly) rather than React state, since a 60fps re-render of the whole
 * overlay for a rotation the eye barely resolves per-frame would be wasted work.
 */
function TourClock({ active, cyclePhaseRef }: { active: boolean; cyclePhaseRef: RefObject<number> }) {
  const handRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    let frameId: number;
    const tick = () => {
      if (handRef.current) handRef.current.style.transform = `rotate(${cyclePhaseRef.current * 360}deg)`;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active, cyclePhaseRef]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="relative h-3 w-3 shrink-0 rounded-full opacity-60"
      style={{ background: `conic-gradient(#c2b199 0deg ${DAY_FRACTION * 360}deg, #6b6558 ${DAY_FRACTION * 360}deg 360deg)` }}
    >
      <div
        ref={handRef}
        className="absolute left-1/2 top-1/2 h-1.5 w-px -translate-x-1/2 -translate-y-full bg-ink/50"
        style={{ transformOrigin: "bottom center" }}
      />
    </div>
  );
}

export interface TripMap3DProps {
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: string | null;
  onSelect: (id: string) => void;
  onTourSelect: (id: string) => void;
  statusFilter: StatusFilter;
  modeFilter: ModeFilter;
  paused?: boolean;
}

/**
 * "Paper diorama" scene: warm directional key light + a cool hemisphere fill
 * so shadow sides don't go flat black, plus a soft ContactShadows blob under
 * the island for the floating-diorama look (fase 1). Extended here (fase 3)
 * with hybrid DOM+mesh markers, animated routes, bounded camera controls,
 * and filter-aware dimming across both the WebGL and DOM layers.
 */
export function TripMap3D({
  stops,
  transportModes,
  selected,
  onSelect,
  onTourSelect,
  statusFilter,
  modeFilter,
  paused = false,
}: TripMap3DProps) {
  const prefersReducedMotion = useReducedMotion();
  const cameraRigRef = useRef<CameraRigHandle>(null);
  const [touring, setTouring] = useState(false);
  /** Deliberate user toggle — independent of the tour's own automatic cycling below, so an evening shower never comes and goes on its own while touring. */
  const [manualEvening, setManualEvening] = useState(false);
  const daytripEntries = useMemo(() => getDaytripEntries(stops), [stops]);
  const plateauCenter = useMemo(getPlateauCenter, []);
  /**
   * All procedural decoration (woodland, scrub, palms, tea, patana grass,
   * boulders, paddy) placed in one seeded pass, keyed off the live stop list so
   * nothing grows through a marker or a route line. Density follows the viewport
   * via useDetailLevel inside the hook.
   */
  const scatter = useMapScatter(stops);

  /** Advanced by DayNightLights' own useFrame; reset to 0 by handleTourDay at the start of every simulated day. Not React state — read at 60fps by a ref, not a re-render. */
  const cyclePhaseRef = useRef(0);
  /** The lights' actual current day/night blend (post-damping); Water reads this each frame so the sea darkens in step with the sky. */
  const nightAmountRef = useRef(0);
  const [dayCounter, setDayCounter] = useState<{ day: number; stop: Stop } | null>(null);

  const [transit, setTransit] = useState<{ from: Stop; to: Stop } | null>(null);

  const handleTourDay = useCallback((stop: Stop, day: number) => {
    cyclePhaseRef.current = 0;
    setDayCounter({ day, stop });
    // Arrival: CameraRig only calls this once flyTo has resolved, so this is
    // exactly when the "onderweg" badge/vehicle should hand off to the real day counter.
    setTransit(null);
  }, []);

  const handleTourTransit = useCallback((from: Stop, to: Stop) => {
    setTransit({ from, to });
  }, []);

  const startTour = useCallback(async () => {
    setTouring(true);
    try {
      await cameraRigRef.current?.playTour();
    } finally {
      setTouring(false);
      setDayCounter(null);
      setTransit(null);
    }
  }, []);

  /** Arbitrary but stable per-day flavor for the fireflies, since Sparkles has no ref to drive from the continuous cycle smoothly; only otherwise relevant outside a tour is the manual toggle. */
  const nightFlavor = dayCounter ? dayCounter.day % 2 === 0 : manualEvening;

  /** One segment per consecutive stop pair, mirroring TripMap.tsx's 2D `segments`. */
  const segments = useMemo(
    () =>
      stops.slice(1).map((stop, i) => ({
        key: stop.id,
        from: getMarkerWorldPosition(stops[i]),
        to: getMarkerWorldPosition(stop),
        mode: stop.transportTo.mode,
        index: i,
      })),
    [stops],
  );

  const daytripLayout = useMemo(
    () =>
      daytripEntries.map((entry) => ({
        entry,
        stopPos: getMarkerWorldPosition(entry.stop),
        activityPos: projectToWorld(entry.activity.lat, entry.activity.lon),
      })),
    [daytripEntries],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
      <Canvas
        flat
        frameloop={paused ? "never" : "always"}
        // Capped at 2x rather than left to follow devicePixelRatio unbounded,
        // which on a 3x phone means rendering 2.25x the pixels of a 2x one for a
        // difference the eye can barely find on a flat-shaded diorama. This is
        // the cheapest headroom available, and it pays for the vegetation added
        // alongside it.
        dpr={[1, 2]}
        // Tight near/far (rather than R3F's default 0.1/1000) so the whole
        // scene, which never spans more than ~40 units deep, uses most of the
        // depth buffer's precision: with the default range almost all of it
        // was wasted on distances nothing ever renders at, which on mobile's
        // lower-precision depth buffers showed up as z-fighting flicker
        // between the water plane and ContactShadows' near-coplanar blob.
        camera={{ position: [5.7, 11.6, 16.2], fov: 32, near: 1, far: 100 }}
      >
        <DayNightLights
          touring={touring}
          manualEvening={manualEvening}
          cyclePhaseRef={cyclePhaseRef}
          nightAmountRef={nightAmountRef}
          prefersReducedMotion={prefersReducedMotion}
        />

        <Water nightRef={nightAmountRef} />
        <Sparkles count={50} scale={[9, 0.4, 9]} position={[0, -0.05, 0]} size={2.4} speed={0.3} opacity={0.55} color="#ffffff" noise={0.6} />
        <Rain3D active={manualEvening} prefersReducedMotion={prefersReducedMotion} />
        {/* Fireflies: real ones are dusk/night creatures, so they're barely there by day and glow once night falls, whether from the manual toggle or the tour's own cycling. */}
        {/* Height comes from getTerrainSurfaceY, not from PLATEAU_LAYER1_TOP: that
            constant is measured *relative* to ISLAND_TOP_Y (TeaBushes adds the two
            together itself), so using it as an absolute world Y put these
            fireflies roughly 0.3 units inside the mountain. */}
        <Sparkles
          count={22}
          scale={[0.9, 0.5, 0.9]}
          position={[plateauCenter.x, getTerrainSurfaceY(plateauCenter.x, plateauCenter.z) + 0.08, plateauCenter.z]}
          size={2.8}
          speed={0.25}
          noise={1.2}
          color="#ffd873"
          opacity={nightFlavor ? 0.85 : 0.1}
        />
        {/* Same correction as above: the Kandy temple stands up in the hill
            country on getTerrainSurfaceY, so anchoring its fireflies to flat
            ISLAND_TOP_Y left them sunk below the terrace the temple is on. */}
        <Sparkles
          count={16}
          scale={[0.35, 0.35, 0.35]}
          position={[
            TEMPLE_POSITIONS[0].x,
            getTerrainSurfaceY(TEMPLE_POSITIONS[0].x, TEMPLE_POSITIONS[0].z) + 0.08,
            TEMPLE_POSITIONS[0].z,
          ]}
          size={2.4}
          speed={0.2}
          noise={1.2}
          color="#ffd873"
          opacity={nightFlavor ? 0.85 : 0.1}
        />
        <Island />
        <Highlands />
        {/* Inland water goes on directly after the terrain and before anything
            standing on it: lakes and the river are flat surfaces lifted a hair
            above the ground, so drawing them here keeps the ordering intuitive
            even though the depth buffer is what actually resolves it. */}
        <InlandWater nightRef={nightAmountRef} />
        {/* Procedural decoration. Seven species, six draw calls total — see
            ScatteredInstances.tsx for why these are instanced when the rest of
            the scene's props are not. */}
        <Vegetation scatter={scatter} prefersReducedMotion={prefersReducedMotion} />
        <Boulders scatter={scatter} />
        <PaddyFields scatter={scatter} />
        <Stupa x={STUPA_POSITION.x} z={STUPA_POSITION.z} />
        <SigiriyaRock x={SIGIRIYA_ROCK_POSITION.x} z={SIGIRIYA_ROCK_POSITION.z} />
        <NineArchesBridge x={NINE_ARCHES_POSITION.x} z={NINE_ARCHES_POSITION.z} rotation={NINE_ARCHES_ROTATION} />
        <GalleFort x={GALLE_FORT_POSITION.x} z={GALLE_FORT_POSITION.z} />
        <Waterfall
          x={WATERFALL_POSITION.x}
          z={WATERFALL_POSITION.z}
          rotation={WATERFALL_ROTATION}
          nightRef={nightAmountRef}
          prefersReducedMotion={prefersReducedMotion}
        />
        <TeaBushes x={plateauCenter.x} z={plateauCenter.z} baseY={PLATEAU_LAYER1_TOP} />
        <Leopard x={LEOPARD_POSITION.x} z={LEOPARD_POSITION.z} prefersReducedMotion={prefersReducedMotion} />
        <Elephant x={ELEPHANT_POSITION.x} z={ELEPHANT_POSITION.z} prefersReducedMotion={prefersReducedMotion} />
        {TEMPLE_POSITIONS.map((p) => (
          <Temple key={`${p.x}-${p.z}`} x={p.x} z={p.z} />
        ))}
        <FishSchool x={FISH_SCHOOL_POSITION.x} z={FISH_SCHOOL_POSITION.z} />
        <Turtle x={TURTLE_POSITION.x} z={TURTLE_POSITION.z} prefersReducedMotion={prefersReducedMotion} />
        <Whale x={WHALE_POSITION.x} z={WHALE_POSITION.z} prefersReducedMotion={prefersReducedMotion} />
        {PALM_TREE_POSITIONS.map((p) => (
          <PalmTree key={`${p.x}-${p.z}`} x={p.x} z={p.z} />
        ))}
        {WAVE_CREST_POSITIONS.map((p) => (
          <WaveCrest key={`${p.x}-${p.z}`} x={p.x} z={p.z} />
        ))}

        <CameraRig
          ref={cameraRigRef}
          stops={stops}
          selected={selected}
          onSelect={onTourSelect}
          onTourDay={handleTourDay}
          onTourTransit={handleTourTransit}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* One-shot vehicle for the tour's currently-transiting leg, in the mode of the
            leg actually being traveled — including "train", alongside Train3D's own
            separate continuous shuttle on the Kandy–Ella line. */}
        {transit && (
          <RoadVehicle3D
            from={getMarkerWorldPosition(transit.from)}
            to={getMarkerWorldPosition(transit.to)}
            kind={transit.to.transportTo.mode}
          />
        )}

        {daytripLayout.map(({ entry, stopPos, activityPos }) => (
          <DaytripConnector3D key={`dl-${entry.activity.id}`} from={stopPos} to={activityPos} />
        ))}

        {segments.map((seg) => (
          <RouteLine3D
            key={seg.key}
            from={seg.from}
            to={seg.to}
            mode={transportModes[seg.mode]}
            index={seg.index}
            dimmed={modeFilter !== "all" && modeFilter !== seg.mode}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}

        {segments
          .filter((seg) => seg.mode === "train")
          .map((seg) => (
            <Train3D key={`train-${seg.key}`} from={seg.from} to={seg.to} />
          ))}

        {stops.map((stop, i) => {
          const statusDimmed = statusFilter === "toBook" && isBookingSettled(stop);
          const modeDimmed = modeFilter !== "all" && modeFilter !== stop.transportTo.mode;
          return (
            <StopMarker3D
              key={stop.id}
              stop={stop}
              order={i + 1}
              isActive={selected === stop.id}
              dimmed={statusDimmed || modeDimmed}
              prefersReducedMotion={prefersReducedMotion}
              onSelect={onSelect}
            />
          );
        })}

        {daytripLayout.map(({ entry }) => (
          <DaytripMarker3D key={entry.activity.id} stop={entry.stop} activity={entry.activity} />
        ))}

        <ContactShadows position={[0, -0.001, 0]} opacity={0.5} blur={2.2} far={4.5} scale={12} color="#2c2319" />
      </Canvas>

      {/* Disabled as a group while touring: the tour drives the camera itself, and a
          recenter/zoom click mid-flight would fight playTour's own sequential setLookAt calls. */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => cameraRigRef.current?.zoomIn()}
          disabled={touring}
          aria-label="Inzoomen"
          className={MAP_BUTTON_CLASS}
        >
          <ZoomIcon mode="in" className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => cameraRigRef.current?.zoomOut()}
          disabled={touring}
          aria-label="Uitzoomen"
          className={MAP_BUTTON_CLASS}
        >
          <ZoomIcon mode="out" className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => cameraRigRef.current?.resetView()}
          disabled={touring}
          aria-label="Kaart centreren"
          className={MAP_BUTTON_CLASS}
        >
          <RecenterIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Independent of the tour's own auto-cycling above — a deliberate mood the user sets, not something the tour should silently override. */}
      <button
        type="button"
        onClick={() => setManualEvening((prev) => !prev)}
        disabled={touring}
        aria-pressed={manualEvening}
        aria-label={manualEvening ? "Avondbui uitzetten" : "Avondbui aanzetten"}
        className={MAP_BUTTON_CLASS + " absolute top-3 right-3"}
      >
        <EveningIcon className="h-5 w-5" />
      </button>

      {/* transit takes priority: while actually traveling, the badge shouldn't
          claim to already be at the destination — that only happens on arrival,
          when handleTourDay clears transit and this falls back to dayCounter. */}
      {(transit || dayCounter) && (
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-ink/10 bg-white/90 px-4 py-2 text-sm font-medium text-ink shadow-[var(--shadow-card)] backdrop-blur">
          {transit ? (
            <>
              <TourIcon className={`h-3.5 w-3.5 text-ink-soft ${prefersReducedMotion ? "" : "animate-pulse"}`} />
              Onderweg naar {transit.to.name}…
            </>
          ) : (
            dayCounter && (
              <>
                <TourClock active={touring} cyclePhaseRef={cyclePhaseRef} />
                Dag {dayCounter.day} · {dayCounter.stop.name}
              </>
            )
          )}
        </div>
      )}

      <button
        type="button"
        onClick={startTour}
        disabled={touring}
        aria-label="Rondleiding langs alle stops"
        className={
          touring
            ? MAP_BUTTON_CLASS + " absolute top-3 left-3"
            : "absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/90 px-3.5 py-2.5 text-sm font-medium text-ink shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-white active:scale-95"
        }
      >
        <TourIcon className="h-4 w-4" />
        {!touring && "Rondleiding"}
      </button>
    </div>
  );
}
