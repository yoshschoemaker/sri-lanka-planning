import { motion } from "framer-motion";
import type { Stop, TransportMode } from "../types/trip";

interface StopCardProps {
  stop: Stop;
  mode: TransportMode;
  isActive: boolean;
  dimmed: boolean;
  onSelect: (n: number) => void;
  registerRef: (n: number, el: HTMLDivElement | null) => void;
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

export function StopCard({ stop, mode, isActive, dimmed, onSelect, registerRef }: StopCardProps) {
  return (
    <motion.div
      ref={(el: HTMLDivElement | null) => registerRef(stop.n, el)}
      id={`stop-${stop.n}`}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      animate={{ opacity: dimmed ? 0.4 : 1 }}
      onClick={() => onSelect(stop.n)}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      aria-label={`Stop ${stop.n}: ${stop.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(stop.n);
        }
      }}
      className={`scroll-mt-24 cursor-pointer rounded-2xl border bg-white/70 p-5 shadow-sm outline-none transition-colors duration-300 sm:p-6 ${
        isActive
          ? "border-terracotta-dark ring-2 ring-terracotta/40"
          : "border-ink/10 hover:border-terracotta-light"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold transition-colors ${
            isActive ? "bg-terracotta-dark text-white" : "bg-sand text-ink"
          }`}
          aria-hidden
        >
          {stop.n}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-serif text-xl font-semibold text-ink sm:text-2xl">{stop.name}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                stop.booked ? "bg-forest/10 text-forest-dark" : "bg-terracotta/10 text-terracotta-dark"
              }`}
            >
              {stop.booked ? "✓ Geboekt" : "○ Nog te boeken"}
            </span>
          </div>

          <p className="mt-1 text-sm text-ink-soft">
            {stop.dates} · {stop.nights} {stop.nights === 1 ? "nacht" : "nachten"}
          </p>

          {stop.note && <p className="mt-2 text-sm text-ink-soft">{stop.note}</p>}

          {stop.warn && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-terracotta/10 px-2.5 py-1.5 text-xs font-medium text-terracotta-dark">
              ⚠ {stop.warn}
            </p>
          )}

          <motion.ul
            variants={listVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="mt-4 flex flex-col gap-1.5"
          >
            {stop.activities.map((activity) => (
              <motion.li
                key={activity.name}
                variants={itemVariants}
                className={`flex items-baseline justify-between gap-3 text-sm ${
                  activity.daytrip ? "italic text-ink-soft" : "text-ink"
                }`}
              >
                <span className="flex items-baseline gap-1.5">
                  <span aria-hidden className="text-terracotta">
                    {activity.daytrip ? "↝" : "•"}
                  </span>
                  {activity.name}
                </span>
                <span className="whitespace-nowrap text-xs text-ink-soft">{activity.dist}</span>
              </motion.li>
            ))}
          </motion.ul>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-soft">
            <span aria-hidden style={{ color: mode.color }}>
              {mode.icon}
            </span>
            aangekomen via {mode.label.toLowerCase()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
