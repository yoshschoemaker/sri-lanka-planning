import { useState } from "react";
import { Html } from "@react-three/drei";
import type { DaytripEntry } from "../../utils/daytrips";
import { projectToWorld } from "../../utils/projection3d";
import { handleActivateKey } from "../../utils/keyboardActivate";
import { ISLAND_TOP_Y } from "./Island";
import { DAYTRIP_HTML_Z } from "./htmlLayers";

const PIN_HEIGHT = 0.1;
const PIN_RADIUS = 0.014;

/**
 * Sideways nudge (px) for the rare daytrip marker sitting inside a stop
 * cluster, where the label's default centered-below position spans wide
 * enough to overlap neighboring stop pins on one side.
 */
const LABEL_OFFSET_OVERRIDES: Record<string, number> = {
  // Sits between Anuradhapura and Sigiriya's markers; centered-below reached
  // both. Shifting west (negative) moves it into the open water there instead.
  "wilpattu-jeep-safari": -40,
};

/**
 * Smaller sibling of StopMarker3D for daytrip activities: a plain dot (no
 * number, matching the 2D map's undotted circle) that expands into a short
 * two-line label on hover/focus, or pinned open via click/tap so it also
 * works without hover on touch devices (mirrors TripMap.tsx's
 * hoveredDaytrip/pinnedDaytrip). Not part of the stops/onSelect flow: like
 * the 2D map, a daytrip marker never selects a Stop or moves the camera.
 * No filter dimming either, matching the 2D map (statusFilter/modeFilter
 * never apply to daytrip circles there).
 */
export function DaytripMarker3D({ stop, activity }: DaytripEntry) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const { x, z } = projectToWorld(activity.lat, activity.lon);
  const expanded = hovered || pinned;
  const labelOffset = LABEL_OFFSET_OVERRIDES[activity.id] ?? 0;

  const toggle = () => setPinned((prev) => !prev);

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, ISLAND_TOP_Y + PIN_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[PIN_RADIUS, PIN_RADIUS, PIN_HEIGHT, 6]} />
        <meshStandardMaterial color="#5c5044" roughness={0.9} flatShading />
      </mesh>

      <Html position={[0, ISLAND_TOP_Y + PIN_HEIGHT, 0]} center zIndexRange={DAYTRIP_HTML_Z}>
        <div
          tabIndex={0}
          role="button"
          aria-pressed={pinned}
          aria-label={`Dagtrip ${activity.name} vanaf ${stop.name}`}
          onClick={toggle}
          onKeyDown={(e) => handleActivateKey(e, toggle)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          className={`marker-glass marker-glass-light marker-glass-dot flex cursor-pointer items-center justify-center rounded-full outline-none transition-all duration-200 ${
            expanded ? "h-4 w-4" : "h-3 w-3"
          }`}
        >
          <div
            aria-hidden
            className="marker-label-glass pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-2xl px-3 py-1.5 text-center transition-all duration-200"
            style={{
              left: `calc(50% + ${labelOffset}px)`,
              transform: `translateX(-50%) scale(${expanded ? 1 : 0.9})`,
              transformOrigin: "top center",
              opacity: expanded ? 1 : 0,
            }}
          >
            <p className="font-serif text-xs font-semibold text-cream">{activity.name}</p>
            <p className="text-[10px] text-cream/80">
              vanuit {stop.name} · {activity.dist}
            </p>
          </div>
        </div>
      </Html>
    </group>
  );
}
