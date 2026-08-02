import { useState } from "react";
import { motion } from "framer-motion";
import type { Stop, Daytrip, TransportMode, TransportModeKey } from "../types/trip";
import {
  MAP_VIEWBOX_WIDTH,
  MAP_VIEWBOX_HEIGHT,
  SRI_LANKA_MAIN_PATH,
  SRI_LANKA_ISLET_PATHS,
} from "../data/srilankaShape";
import { project } from "../utils/projection";
import { getMarkerPosition, getLabelPlacement } from "../utils/mapLayout";
import type { ModeFilter, StatusFilter } from "./FilterBar";

interface TripMapProps {
  stops: Stop[];
  daytrips: Daytrip[];
  transportModes: Record<TransportModeKey, TransportMode>;
  selected: number | null;
  onSelect: (n: number) => void;
  statusFilter: StatusFilter;
  modeFilter: ModeFilter;
}

const MARKER_R = 12;
const PAD = 6;

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function TripMap({
  stops,
  daytrips,
  transportModes,
  selected,
  onSelect,
  statusFilter,
  modeFilter,
}: TripMapProps) {
  const [hoveredStop, setHoveredStop] = useState<number | null>(null);
  const [hoveredDaytrip, setHoveredDaytrip] = useState<string | null>(null);
  const [settled, setSettled] = useState<Record<number, boolean>>({});

  const positions = stops.map((stop) => ({ stop, pos: getMarkerPosition(stop) }));
  const segments = stops.slice(1).map((stop, i) => ({
    key: stop.n,
    from: positions[i].pos,
    to: positions[i + 1].pos,
    mode: stop.transportTo.mode,
  }));

  const tooltipStopN = hoveredStop ?? selected;
  const tooltipStop = tooltipStopN != null ? stops.find((s) => s.n === tooltipStopN) ?? null : null;

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

        {daytrips.map((daytrip) => {
          const dp = project(daytrip.lat, daytrip.lon);
          const parent = positions.find((p) => p.stop.name === daytrip.from);
          if (!parent) return null;
          return (
            <line
              key={`dl-${daytrip.name}`}
              x1={parent.pos.x}
              y1={parent.pos.y}
              x2={dp.x}
              y2={dp.y}
              stroke="#8a8072"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.5}
            />
          );
        })}

        {segments.map((seg, i) => {
          const mode = transportModes[seg.mode];
          const dimmed = modeFilter !== "all" && modeFilter !== seg.mode;
          const len = distance(seg.from, seg.to);
          const delay = 0.2 + i * 0.14;
          return (
            <motion.path
              key={seg.key}
              d={`M${seg.from.x},${seg.from.y} L${seg.to.x},${seg.to.y}`}
              fill="none"
              stroke={mode.color}
              strokeWidth={3.25}
              strokeLinecap="round"
              style={{
                strokeDasharray: settled[seg.key] && mode.style === "dashed" ? "1 9" : len,
              }}
              initial={{ strokeDashoffset: len }}
              animate={{ strokeDashoffset: 0, opacity: dimmed ? 0.25 : 1 }}
              transition={{ strokeDashoffset: { duration: 0.9, delay, ease: "easeInOut" }, opacity: { duration: 0.4 } }}
              onAnimationComplete={() => {
                console.log("DEBUG settle", seg.key);
                setSettled((prev) => ({ ...prev, [seg.key]: true }));
              }}
            />
          );
        })}

        {daytrips.map((daytrip) => {
          const dp = project(daytrip.lat, daytrip.lon);
          const isHovered = hoveredDaytrip === daytrip.name;
          const parent = positions.find((p) => p.stop.name === daytrip.from);
          return (
            <g
              key={daytrip.name}
              tabIndex={0}
              role="button"
              aria-label={`Dagtrip ${daytrip.name} vanaf ${daytrip.from}`}
              onMouseEnter={() => setHoveredDaytrip(daytrip.name)}
              onMouseLeave={() => setHoveredDaytrip(null)}
              onFocus={() => setHoveredDaytrip(daytrip.name)}
              onBlur={() => setHoveredDaytrip(null)}
              onClick={() => parent && onSelect(parent.stop.n)}
              className="cursor-pointer outline-none"
            >
              <circle
                cx={dp.x}
                cy={dp.y}
                r={isHovered ? 6.5 : 5}
                className="fill-cream stroke-ink-soft transition-all"
                strokeWidth={1.5}
              />
              <text
                x={dp.x + 9}
                y={dp.y}
                dominantBaseline="middle"
                className="map-label pointer-events-none fill-ink-soft italic"
                style={{ fontFamily: "var(--font-serif)", fontSize: 11 }}
              >
                {daytrip.name}
              </text>
            </g>
          );
        })}

        {positions.map(({ stop, pos }, i) => {
          const mode = transportModes[stop.transportTo.mode];
          const isActive = selected === stop.n;
          const statusDimmed = statusFilter === "toBook" && stop.booked;
          const modeDimmed = modeFilter !== "all" && modeFilter !== stop.transportTo.mode;
          const dimmed = statusDimmed || modeDimmed;
          const label = getLabelPlacement(stop);

          return (
            <motion.g
              key={stop.n}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: dimmed ? 0.35 : 1 }}
              transition={{ scale: { duration: 0.4, delay: 0.25 + i * 0.1, ease: "backOut" }, opacity: { duration: 0.3 } }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.95 }}
              style={{ transformOrigin: `${pos.x}px ${pos.y}px`, cursor: "pointer" }}
              tabIndex={0}
              role="button"
              aria-label={`${stop.name}, ${stop.nights} nachten, ${stop.booked ? "geboekt" : "nog te boeken"}`}
              aria-pressed={isActive}
              onClick={() => onSelect(stop.n)}
              onMouseEnter={() => setHoveredStop(stop.n)}
              onMouseLeave={() => setHoveredStop(null)}
              onFocus={() => setHoveredStop(stop.n)}
              onBlur={() => setHoveredStop(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(stop.n);
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
                  animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0.15, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? MARKER_R + 1.5 : MARKER_R}
                className={isActive ? "fill-terracotta-dark" : "fill-ink"}
                stroke="var(--color-cream)"
                strokeWidth={2}
              />
              <text
                x={pos.x}
                y={pos.y}
                dominantBaseline="central"
                textAnchor="middle"
                className="pointer-events-none fill-cream font-sans font-semibold"
                style={{ fontSize: 11 }}
              >
                {stop.n}
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
              </title>
            </motion.g>
          );
        })}

        {tooltipStop && <MapTooltip stop={tooltipStop} pos={getMarkerPosition(tooltipStop)} mode={transportModes[tooltipStop.transportTo.mode]} />}
      </svg>

      <MapLegend transportModes={transportModes} />
    </div>
  );
}

function MapTooltip({
  stop,
  pos,
  mode,
}: {
  stop: Stop;
  pos: { x: number; y: number };
  mode: TransportMode;
}) {
  const lines = [
    stop.name,
    `${stop.dates} · ${stop.nights} ${stop.nights === 1 ? "nacht" : "nachten"}`,
    `${mode.icon} ${mode.label} · ${stop.transportTo.duration}`,
    stop.booked ? "✓ Geboekt" : "○ Nog te boeken",
  ];
  const boxWidth = 168;
  const boxHeight = lines.length * 16 + 14;
  let rectX = pos.x - boxWidth / 2;
  rectX = Math.max(PAD, Math.min(rectX, MAP_VIEWBOX_WIDTH - PAD - boxWidth));
  const above = pos.y - MARKER_R - 10 - boxHeight;
  const rectY = above > PAD ? above : pos.y + MARKER_R + 10;

  return (
    <g className="pointer-events-none">
      <rect
        x={rectX}
        y={rectY}
        width={boxWidth}
        height={boxHeight}
        rx={10}
        className="fill-ink/95"
      />
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
        dagtrip
      </span>
    </div>
  );
}
