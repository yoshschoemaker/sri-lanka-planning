import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { motion } from "framer-motion";
import type { Stop } from "../../types/trip";
import { getMarkerWorldPosition, getLabelDirection } from "../../utils/mapLayout3d";
import { handleActivateKey } from "../../utils/keyboardActivate";
import { selectPulse } from "../../motion/variants";
import { ISLAND_TOP_Y } from "./Island";

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

      <Html position={[0, ISLAND_TOP_Y + PIN_HEIGHT, 0]} center>
        <div
          tabIndex={0}
          role="button"
          aria-pressed={isActive}
          aria-label={`${stop.name}, ${stop.nights} ${stop.nights === 1 ? "nacht" : "nachten"}, ${
            stop.booked ? "geboekt" : "nog te boeken"
          }`}
          onClick={activate}
          onKeyDown={(e) => handleActivateKey(e, activate)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          style={{ opacity: dimmed ? DIMMED_OPACITY : 1, transition: "opacity 0.3s" }}
          className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-cream font-sans text-sm font-semibold text-cream shadow-md outline-none transition-colors ${
            isActive ? "bg-terracotta-dark" : "bg-ink"
          }`}
        >
          {isActive && (
            <motion.span
              aria-hidden
              variants={selectPulse}
              initial="idle"
              animate={prefersReducedMotion ? "idle" : "pulse"}
              className="pointer-events-none absolute -inset-2 rounded-full border-2 border-terracotta-dark"
            />
          )}

          {order}

          {stop.booked && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-1 -top-1 h-3 w-3 rounded-full border border-cream bg-forest"
            />
          )}

          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 whitespace-nowrap rounded-full bg-ink/95 px-2.5 py-1 font-serif text-xs font-semibold text-cream shadow-[var(--shadow-card)] transition-opacity duration-200"
            style={{
              [labelDirection === "right" ? "left" : "right"]: "calc(100% + 10px)",
              transform: "translateY(-50%)",
              opacity: expanded ? 1 : 0,
            }}
          >
            {stop.name}
          </span>
        </div>
      </Html>
    </group>
  );
}
