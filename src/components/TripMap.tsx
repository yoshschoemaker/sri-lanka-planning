import { useState } from "react";
import { motion } from "framer-motion";
import type { Stop, TransportMode, TransportModeKey } from "../types/trip";
import {
  MAP_VIEWBOX_WIDTH,
  MAP_VIEWBOX_HEIGHT,
  SRI_LANKA_MAIN_PATH,
  SRI_LANKA_ISLET_PATHS,
} from "../data/srilankaShape";
import { project } from "../utils/projection";
import { getMarkerPosition, getLabelPlacement } from "../utils/mapLayout";
import { getDaytripEntries } from "../utils/daytrips";
import { isBookingSettled, isStopover, nightsLabel } from "../utils/nights";
import { useReducedMotion } from "../utils/useReducedMotion";
import { DIM_DURATION, hoverLift, selectPulse, tapShrink } from "../motion/variants";
import type { ModeFilter, StatusFilter } from "./FilterBar";

interface TripMapProps {
  stops: Stop[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: string | null;
  onSelect: (id: string) => void;
  statusFilter: StatusFilter;
  modeFilter: ModeFilter;
}

const MARKER_R = 12;
const PAD = 6;
const DRAW_DURATION = 0.9;

export function TripMap({ stops, transportModes, selected, onSelect, statusFilter, modeFilter }: TripMapProps) {
  const [hoveredStop, setHoveredStop] = useState<string | null>(null);
  const [hoveredDaytrip, setHoveredDaytrip] = useState<string | null>(null);
  const [pinnedDaytrip, setPinnedDaytrip] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const positions = stops.map((stop) => ({ stop, pos: getMarkerPosition(stop) }));
  const segments = stops.slice(1).map((stop, i) => ({
    key: stop.id,
    from: positions[i].pos,
    to: positions[i + 1].pos,
    mode: stop.transportTo.mode,
  }));

  const daytripEntries = getDaytripEntries(stops);

  const tooltipStopId = hoveredStop ?? selected;
  const tooltipStop = tooltipStopId != null ? stops.find((s) => s.id === tooltipStopId) ?? null : null;

  const tooltipDaytripId = hoveredDaytrip ?? pinnedDaytrip;
  const tooltipDaytrip = tooltipDaytripId
    ? daytripEntries.find((entry) => entry.activity.id === tooltipDaytripId) ?? null
    : null;

  return (
    <div className="rounded-3xl border border-ink/10 bg-white/50 p-3 sm:p-5">
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
        role="img"
        aria-label="Kaart van Sri Lanka met de route en overnachtingsplekken"
        className="h-auto w-full max-w-md mx-auto"
      >
        {SRI_LANKA_ISLET_PATHS.map((d, i) => (
          <path key={i} d={d} className="fill-terracotta-light/70 stroke-terracotta-dark/40" strokeWidth={1} />
        ))}
        <path
          d={SRI_LANKA_MAIN_PATH}
          className="fill-terracotta-light stroke-terracotta-dark/50"
          strokeWidth={1.5}
        />

        {daytripEntries.map(({ stop, activity }) => {
          const dp = project(activity.lat, activity.lon);
          const parentPos = getMarkerPosition(stop);
          return (
            <line
              key={`dl-${activity.id}`}
              x1={parentPos.x}
              y1={parentPos.y}
              x2={dp.x}
              y2={dp.y}
              stroke="#8a8072"
              strokeWidth={0.7}
              strokeLinecap="round"
              strokeDasharray="0.1 2.6"
              opacity={0.32}
            />
          );
        })}

        {segments.map((seg, i) => {
          const mode = transportModes[seg.mode];
          const dimmed = modeFilter !== "all" && modeFilter !== seg.mode;
          const dx = seg.to.x - seg.from.x;
          const dy = seg.to.y - seg.from.y;
          const len = Math.hypot(dx, dy);
          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          const delay = 0.2 + i * 0.14;
          const clipId = `route-clip-${seg.key}`;
          const perp = 10;

          return (
            <g key={seg.key}>
              <clipPath id={clipId}>
                <motion.rect
                  x={seg.from.x}
                  y={seg.from.y - perp}
                  height={perp * 2}
                  initial={prefersReducedMotion ? false : { width: 0 }}
                  animate={{ width: len + 4 }}
                  transition={
                    prefersReducedMotion ? { duration: 0 } : { duration: DRAW_DURATION, delay, ease: "easeInOut" }
                  }
                  transform={`rotate(${angleDeg} ${seg.from.x} ${seg.from.y})`}
                />
              </clipPath>
              <path
                d={`M${seg.from.x},${seg.from.y} L${seg.to.x},${seg.to.y}`}
                fill="none"
                stroke={mode.color}
                strokeWidth={3.25}
                strokeLinecap="round"
                strokeDasharray={mode.style === "dashed" ? "8 6" : undefined}
                clipPath={`url(#${clipId})`}
                style={{ opacity: dimmed ? 0.25 : 1, transition: `opacity ${DIM_DURATION}s` }}
              />
            </g>
          );
        })}

        {daytripEntries.map(({ stop, activity }) => {
          const dp = project(activity.lat, activity.lon);
          const isActive = tooltipDaytripId === activity.id;
          return (
            <g
              key={activity.id}
              tabIndex={0}
              role="button"
              aria-label={`Dagtrip ${activity.name} vanaf ${stop.name}`}
              aria-pressed={isActive}
              onMouseEnter={() => setHoveredDaytrip(activity.id)}
              onMouseLeave={() => setHoveredDaytrip(null)}
              onFocus={() => setHoveredDaytrip(activity.id)}
              onBlur={() => setHoveredDaytrip(null)}
              onClick={() => setPinnedDaytrip((prev) => (prev === activity.id ? null : activity.id))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPinnedDaytrip((prev) => (prev === activity.id ? null : activity.id));
                }
              }}
              className="cursor-pointer outline-none"
            >
              <circle
                cx={dp.x}
                cy={dp.y}
                r={isActive ? 6.5 : 5}
                className="fill-cream stroke-ink-soft transition-all"
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {positions.map(({ stop, pos }, i) => {
          const mode = transportModes[stop.transportTo.mode];
          const isActive = selected === stop.id;
          const statusDimmed = statusFilter === "toBook" && isBookingSettled(stop);
          const modeDimmed = modeFilter !== "all" && modeFilter !== stop.transportTo.mode;
          const dimmed = statusDimmed || modeDimmed;
          const label = getLabelPlacement(stop);
          // Doortocht: gestippelde, lichte marker, net als de gestippelde rand van zijn kaart.
          const stopover = isStopover(stop);
          const outlined = stopover && !isActive;

          return (
            <motion.g
              key={stop.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: dimmed ? 0.35 : 1 }}
              transition={{
                scale: { duration: 0.4, delay: 0.25 + i * 0.1, ease: "backOut" },
                opacity: { duration: DIM_DURATION },
              }}
              whileHover={hoverLift}
              whileTap={tapShrink}
              style={{ transformOrigin: `${pos.x}px ${pos.y}px`, cursor: "pointer" }}
              tabIndex={0}
              role="button"
              aria-label={
                isStopover(stop)
                  ? `${stop.name}, tussenstop zonder overnachting`
                  : `${stop.name}, ${nightsLabel(stop)}, ${stop.booked ? "geboekt" : "nog te boeken"}`
              }
              aria-pressed={isActive}
              onClick={() => onSelect(stop.id)}
              onMouseEnter={() => setHoveredStop(stop.id)}
              onMouseLeave={() => setHoveredStop(null)}
              onFocus={() => setHoveredStop(stop.id)}
              onBlur={() => setHoveredStop(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(stop.id);
                }
              }}
              className="outline-none"
            >
              {isActive && (
                <motion.circle
                  cx={pos.x}
                  cy={pos.y}
                  r={MARKER_R + 7}
                  fill="none"
                  stroke="var(--color-terracotta-dark)"
                  strokeWidth={2}
                  variants={selectPulse}
                  initial="idle"
                  animate={prefersReducedMotion ? "idle" : "pulse"}
                  style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? MARKER_R + 1.5 : MARKER_R}
                className={isActive ? "fill-terracotta-dark" : outlined ? "fill-cream" : "fill-ink"}
                stroke={outlined ? "var(--color-ink)" : "var(--color-cream)"}
                strokeWidth={2}
                strokeDasharray={outlined ? "3 2.5" : undefined}
              />
              <text
                x={pos.x}
                y={pos.y}
                dominantBaseline="central"
                textAnchor="middle"
                className={`pointer-events-none font-sans font-semibold ${outlined ? "fill-ink" : "fill-cream"}`}
                style={{ fontSize: 11 }}
              >
                {i + 1}
              </text>
              {stop.booked && (
                <circle
                  cx={pos.x + MARKER_R - 2}
                  cy={pos.y - MARKER_R + 2}
                  r={4.5}
                  className="fill-forest stroke-cream"
                  strokeWidth={1.25}
                />
              )}
              <text
                x={pos.x + label.dx}
                y={pos.y + label.dy}
                dominantBaseline="middle"
                textAnchor={label.anchor}
                className="map-label pointer-events-none fill-ink font-semibold"
                style={{ fontFamily: "var(--font-serif)", fontSize: 13.5 }}
              >
                {stop.name}
              </text>
              <title>
                {stop.name} · {stop.dates} · {mode.icon} {mode.label}
                {stopover ? " · tussenstop" : ""}
              </title>
            </motion.g>
          );
        })}

        {tooltipDaytrip ? (
          <MapTooltip
            pos={project(tooltipDaytrip.activity.lat, tooltipDaytrip.activity.lon)}
            lines={[
              tooltipDaytrip.activity.name,
              `Dagtrip vanuit ${tooltipDaytrip.stop.name}`,
              tooltipDaytrip.activity.dist,
            ]}
          />
        ) : (
          tooltipStop && (
            <MapTooltip
              pos={getMarkerPosition(tooltipStop)}
              lines={[
                tooltipStop.name,
                `${tooltipStop.dates} · ${nightsLabel(tooltipStop)}`,
                `${transportModes[tooltipStop.transportTo.mode].icon} ${transportModes[tooltipStop.transportTo.mode].label} · ${tooltipStop.transportTo.duration}`,
                isStopover(tooltipStop) ? "⏱ Tussenstop, geen verblijf" : tooltipStop.booked ? "✓ Geboekt" : "○ Nog te boeken",
              ]}
            />
          )
        )}
      </svg>

      <MapLegend transportModes={transportModes} />
    </div>
  );
}

function MapTooltip({ pos, lines }: { pos: { x: number; y: number }; lines: string[] }) {
  const boxWidth = 190;
  const boxHeight = lines.length * 16 + 14;
  let rectX = pos.x - boxWidth / 2;
  rectX = Math.max(PAD, Math.min(rectX, MAP_VIEWBOX_WIDTH - PAD - boxWidth));
  const above = pos.y - MARKER_R - 10 - boxHeight;
  const rectY = above > PAD ? above : pos.y + MARKER_R + 10;

  return (
    <g className="pointer-events-none">
      <rect x={rectX} y={rectY} width={boxWidth} height={boxHeight} rx={10} className="fill-ink/95" />
      {lines.map((line, i) => (
        <text
          key={i}
          x={rectX + 12}
          y={rectY + 18 + i * 16}
          className={i === 0 ? "fill-cream font-semibold" : "fill-cream/85"}
          style={{ fontFamily: i === 0 ? "var(--font-serif)" : "var(--font-sans)", fontSize: i === 0 ? 13.5 : 11.5 }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function MapLegend({ transportModes }: { transportModes: Record<TransportModeKey, TransportMode> }) {
  const entries = Object.entries(transportModes) as [TransportModeKey, TransportMode][];
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-ink/10 pt-3 text-xs text-ink-soft">
      {entries.map(([key, mode]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0.5 w-5 rounded-full"
            style={{
              backgroundColor: mode.style === "dashed" ? "transparent" : mode.color,
              backgroundImage:
                mode.style === "dashed" ? `linear-gradient(90deg, ${mode.color} 55%, transparent 0%)` : undefined,
              backgroundSize: mode.style === "dashed" ? "7px 2px" : undefined,
            }}
          />
          {mode.icon} {mode.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border border-ink-soft bg-cream" />
        dagtrip (klik voor info)
      </span>
    </div>
  );
}
