import { useState } from "react";
import { Html } from "@react-three/drei";
import type { DaytripEntry } from "../../utils/daytrips";
import { projectToWorld } from "../../utils/projection3d";
import { handleActivateKey } from "../../utils/keyboardActivate";
import { ISLAND_TOP_Y } from "./Island";

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

      <Html position={[0, ISLAND_TOP_Y + PIN_HEIGHT, 0]} center>
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
          className={`relative flex cursor-pointer items-center justify-center rounded-full border-[1.5px] border-ink-soft bg-cream shadow-sm outline-none transition-all ${
            expanded ? "h-3.5 w-3.5" : "h-2.5 w-2.5"
          }`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute top-full mt-1.5 whitespace-nowrap rounded-xl bg-ink/95 px-2.5 py-1.5 text-center shadow-[var(--shadow-card)] transition-opacity duration-200"
            style={{ left: `calc(50% + ${labelOffset}px)`, transform: "translateX(-50%)", opacity: expanded ? 1 : 0 }}
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
