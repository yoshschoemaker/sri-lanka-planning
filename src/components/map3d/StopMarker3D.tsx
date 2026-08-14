import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { motion } from "framer-motion";
import type { Stop } from "../../types/trip";
import { getMarkerWorldPosition, getLabelDirection } from "../../utils/mapLayout3d";
import { handleActivateKey } from "../../utils/keyboardActivate";
import { isStopover, nightsLabel } from "../../utils/nights";
import { selectPulse } from "../../motion/variants";
import { ISLAND_TOP_Y } from "./Island";
import { STOP_HTML_Z } from "./htmlLayers";

const PIN_HEIGHT = 0.16;
const PIN_RADIUS = 0.02;

/** Matches TripMap.tsx's stop-marker dim value exactly, for visual parity with the 2D fallback. */
const DIMMED_OPACITY = 0.35;
/** Exponential damp rate approximating DIM_DURATION's (0.3s) settle feel; WebGL materials have no CSS transitions. */
const OPACITY_LAMBDA = 10;

interface StopMarker3DProps {
  stop: Stop;
  order: number;
  isActive: boolean;
  dimmed: boolean;
  prefersReducedMotion: boolean;
  onSelect: (id: string) => void;
}

/**
 * Hybrid DOM + mesh marker: a small pin mesh anchors the stop to the terrain
 * (and, being a normal scene mesh, is automatically picked up by
 * TripMap3D's ContactShadows blob, no extra castShadow wiring needed), while
 * a drei <Html> badge carries the real, accessible DOM interaction. Only the
 * compact number shows by default; the full name expands on hover/focus/
 * selection so at most one label is ever visible, which is what structurally
 * avoids the 2D map's recurring label-overlap tuning.
 */
export function StopMarker3D({ stop, order, isActive, dimmed, prefersReducedMotion, onSelect }: StopMarker3DProps) {
  const [hovered, setHovered] = useState(false);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const { x, z } = getMarkerWorldPosition(stop);
  const labelDirection = getLabelDirection(stop.id);
  const expanded = isActive || hovered;
  // Doortocht: omgekeerde, gestippelde badge, net als de 2D-marker en de kaart in de route.
  const stopover = isStopover(stop);
  const outlined = stopover && !isActive;

  useFrame((_state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const target = dimmed ? DIMMED_OPACITY : 1;
    material.opacity = prefersReducedMotion ? target : THREE.MathUtils.damp(material.opacity, target, OPACITY_LAMBDA, delta);
  });

  const activate = () => onSelect(stop.id);

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, ISLAND_TOP_Y + PIN_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[PIN_RADIUS, PIN_RADIUS, PIN_HEIGHT, 6]} />
        <meshStandardMaterial
          ref={materialRef}
          color={isActive ? "#9c5030" : "#2c2319"}
          roughness={0.9}
          flatShading
          transparent
        />
      </mesh>

      <Html position={[0, ISLAND_TOP_Y + PIN_HEIGHT, 0]} center zIndexRange={STOP_HTML_Z}>
        <div
          tabIndex={0}
          role="button"
          aria-pressed={isActive}
          aria-label={
            stopover
              ? `${stop.name}, tussenstop zonder overnachting`
              : `${stop.name}, ${nightsLabel(stop)}, ${stop.booked ? "geboekt" : "nog te boeken"}`
          }
          onClick={activate}
          onKeyDown={(e) => handleActivateKey(e, activate)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          style={{
            opacity: dimmed ? DIMMED_OPACITY : 1,
            transform: expanded && !prefersReducedMotion ? "scale(1.12)" : "scale(1)",
            transition: "opacity 0.3s, transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1)",
          }}
          className={`marker-glass flex h-8 w-8 cursor-pointer items-center justify-center rounded-full font-sans text-[13px] font-semibold tracking-tight outline-none ${
            outlined
              ? "marker-glass-light marker-glass-dashed text-ink"
              : `marker-text-shadow text-cream ${isActive ? "marker-glass-active" : "marker-glass-ink"}`
          }`}
        >
          {isActive && (
            <motion.span
              aria-hidden
              variants={selectPulse}
              initial="idle"
              animate={prefersReducedMotion ? "idle" : "pulse"}
              className="pointer-events-none absolute -inset-2 rounded-full border border-cream/70"
            />
          )}

          {order}

          {stop.booked && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-forest shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.6),0_0_0_1.5px_rgba(250,245,234,0.85)]"
            />
          )}

          <span
            aria-hidden
            className="marker-label-glass pointer-events-none absolute top-1/2 whitespace-nowrap rounded-full px-3 py-1 font-serif text-xs font-semibold text-cream transition-all duration-200"
            style={{
              [labelDirection === "right" ? "left" : "right"]: "calc(100% + 10px)",
              transformOrigin: labelDirection === "right" ? "left center" : "right center",
              transform: `translateY(-50%) scale(${expanded ? 1 : 0.9})`,
              opacity: expanded ? 1 : 0,
            }}
          >
            {stopover ? `${stop.name} · tussenstop` : stop.name}
          </span>
        </div>
      </Html>
    </group>
  );
}
