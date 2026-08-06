import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Sparkles } from "@react-three/drei";
import type { Stop, TransportMode, TransportModeKey } from "../../types/trip";
import type { ModeFilter, StatusFilter } from "../FilterBar";
import { getDaytripEntries } from "../../utils/daytrips";
import { getMarkerWorldPosition } from "../../utils/mapLayout3d";
import { projectToWorld } from "../../utils/projection3d";
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
import { Highlands, PLATEAU_LAYER1_TOP, getPlateauCenter } from "./Highlands";
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

/** Empty coastal/inland spots the stop/daytrip/route layout never touches, so these purely decorative elements never collide with real UI. */
const PALM_TREE_POSITIONS = [
  { x: 1.55, z: 0.75 }, // east coast, Trincomalee-ish
  { x: -1.0, z: 3.95 }, // south coast dunes near Mirissa/Hikkaduwa
  { x: 0.15, z: -2.6 }, // northern peninsula — real palmyra-palm country
];
/** Sampled around the whole coastline (offset outward from the coastline ring, verified in water), spaced so no two crowd the same stretch of coast. */
const WAVE_CREST_POSITIONS = [
  { x: 2.4, z: 0.85 }, // east coast
  { x: 0.3, z: 4.7 }, // open water south of the island, off the surf coast
  { x: 2.64, z: 1.96 }, // northeast coast
  { x: 0.98, z: 4.06 }, // south coast
  { x: -1.0, z: 4.53 }, // south coast, near Mirissa/Hikkaduwa
  { x: -1.89, z: 3.25 }, // southwest coast
  { x: -2.22, z: 1.91 }, // west coast
  { x: -2.66, z: -0.45 }, // west coast, north of Negombo
  { x: -2.11, z: -2.55 }, // northwest coast
  { x: -1.39, z: -3.82 }, // near the northern peninsula
  { x: -0.08, z: -3.48 }, // north tip
  { x: 0.49, z: -2.83 }, // northeast coast
  { x: 1.15, z: -2.06 }, // northeast coast
  { x: 1.67, z: -0.53 }, // east coast, north of Trincomalee
];
const STUPA_POSITION = { x: -0.15, z: -1.9 }; // north of the Anuradhapura marker, clear of its pin/label
const LEOPARD_POSITION = { x: -1.3, z: -1.65 }; // near the Wilpattu daytrip marker, clear of its dot
const ELEPHANT_POSITION = { x: 0.65, z: 3.05 }; // near the Udawalawe stop marker, clear of its pin
/** Temple of the Tooth (Kandy) and the Dambulla cave temple daytrip — both real temple visits, so they get Temple.tsx's tiered-roof vihara rather than Stupa.tsx's dagoba dome. */
const TEMPLE_POSITIONS = [
  { x: -0.15, z: 1.42 }, // Kandy
  { x: -0.38, z: 0.1 }, // Dambulla cave temple daytrip
];
const FISH_SCHOOL_POSITION = { x: -1.65, z: 3.82 }; // just off Hikkaduwa's Coral Sanctuary snorkel spot
const TURTLE_POSITION = { x: 0.28, z: 4.1 }; // off Tangalle, near Rekawa's turtle beach
const WHALE_POSITION = { x: -0.4, z: 4.6 }; // open water south of Mirissa, where the whale-watching boats actually go (kept just inside the camera's default framing)
const SIGIRIYA_ROCK_POSITION = { x: 0.45, z: -0.03 }; // east of the Sigiriya marker, clear of both its pin circle and the Dambulla temple nearby

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

export interface TripMap3DProps {
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: string | null;
  onSelect: (id: string) => void;
  statusFilter: StatusFilter;
  modeFilter: ModeFilter;
}

/**
 * "Paper diorama" scene: warm directional key light + a cool hemisphere fill
 * so shadow sides don't go flat black, plus a soft ContactShadows blob under
 * the island for the floating-diorama look (fase 1). Extended here (fase 3)
 * with hybrid DOM+mesh markers, animated routes, bounded camera controls,
 * and filter-aware dimming across both the WebGL and DOM layers.
 */
export function TripMap3D({ stops, transportModes, selected, onSelect, statusFilter, modeFilter }: TripMap3DProps) {
  const prefersReducedMotion = useReducedMotion();
  const cameraRigRef = useRef<CameraRigHandle>(null);
  const daytripEntries = useMemo(() => getDaytripEntries(stops), [stops]);
  const plateauCenter = useMemo(getPlateauCenter, []);

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
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      <Canvas flat camera={{ position: [5.7, 11.6, 16.2], fov: 32 }}>
        {/* `flat` (NoToneMapping) keeps the flat-shaded diorama's colors as vivid as authored; ACES's default filmic
            curve was quietly crushing the water's blues toward navy. */}
        <hemisphereLight args={["#fff1dd", "#3a2a1d", 0.75]} />
        <directionalLight position={[4.5, 7, 3]} intensity={1.7} color="#ffddb3" />
        {/* Cool rim/fill from the opposite side, low enough to stay a fill light rather than a second key. */}
        <directionalLight position={[-5, 4, -4]} intensity={0.35} color="#bfe3ff" />
        <ambientLight intensity={0.18} />

        <Water />
        <Sparkles count={50} scale={[9, 0.4, 9]} position={[0, -0.05, 0]} size={2.4} speed={0.3} opacity={0.55} color="#ffffff" noise={0.6} />
        <Island />
        <Highlands />
        <Stupa x={STUPA_POSITION.x} z={STUPA_POSITION.z} />
        <SigiriyaRock x={SIGIRIYA_ROCK_POSITION.x} z={SIGIRIYA_ROCK_POSITION.z} />
        <TeaBushes x={plateauCenter.x} z={plateauCenter.z} baseY={PLATEAU_LAYER1_TOP} />
        <Leopard x={LEOPARD_POSITION.x} z={LEOPARD_POSITION.z} />
        <Elephant x={ELEPHANT_POSITION.x} z={ELEPHANT_POSITION.z} />
        {TEMPLE_POSITIONS.map((p) => (
          <Temple key={`${p.x}-${p.z}`} x={p.x} z={p.z} />
        ))}
        <FishSchool x={FISH_SCHOOL_POSITION.x} z={FISH_SCHOOL_POSITION.z} />
        <Turtle x={TURTLE_POSITION.x} z={TURTLE_POSITION.z} />
        <Whale x={WHALE_POSITION.x} z={WHALE_POSITION.z} />
        {PALM_TREE_POSITIONS.map((p) => (
          <PalmTree key={`${p.x}-${p.z}`} x={p.x} z={p.z} />
        ))}
        {WAVE_CREST_POSITIONS.map((p) => (
          <WaveCrest key={`${p.x}-${p.z}`} x={p.x} z={p.z} />
        ))}

        <CameraRig ref={cameraRigRef} stops={stops} selected={selected} prefersReducedMotion={prefersReducedMotion} />

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
          const statusDimmed = statusFilter === "toBook" && stop.booked;
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

      <button
        type="button"
        onClick={() => cameraRigRef.current?.resetView()}
        aria-label="Kaart centreren"
        className="absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white/90 text-ink shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-white active:scale-95"
      >
        <RecenterIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
