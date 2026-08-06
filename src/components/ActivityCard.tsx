import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Activity, ActivityPriority } from "../types/trip";
import { dimTransition } from "../motion/variants";

interface ActivityCardProps {
  activity: Activity;
  dimmed?: boolean;
}

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

/** Purely a personal planning aid — edit priority in data.ts per activity, there's no "right" answer here. */
const PRIORITY_CONFIG: Record<ActivityPriority, { label: string; badgeClassName: string; barClassName: string }> = {
  must: { label: "Must see/do", badgeClassName: "bg-terracotta-dark text-cream", barClassName: "bg-terracotta-dark" },
  nice: { label: "Leuk idee", badgeClassName: "bg-sand text-ink", barClassName: "bg-sand" },
  maybe: { label: "Misschien", badgeClassName: "border border-ink/15 bg-white/70 text-ink-soft", barClassName: "bg-ink/15" },
};

function PriorityBadge({ priority }: { priority: ActivityPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${config.badgeClassName}`}>
      {config.label}
    </span>
  );
}

/** A thin strip card per activity (rather than a plain bulleted row), so the priority label and distance both read at a glance. */
export function ActivityCard({ activity, dimmed = false }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasPhoto = Boolean(activity.photos && activity.photos.length > 0);
  const hasDetail = Boolean(activity.description) || hasPhoto;
  const barClassName = activity.priority ? PRIORITY_CONFIG[activity.priority].barClassName : "bg-ink/10";

  const row = (
    <span className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden className="shrink-0 text-terracotta">
          {activity.daytrip ? "↝" : "•"}
        </span>
        <span className={`truncate ${activity.daytrip ? "italic" : ""}`}>{activity.name}</span>
      </span>
      <span className="flex items-center gap-2 whitespace-nowrap">
        {activity.priority && <PriorityBadge priority={activity.priority} />}
        <span className="text-xs text-ink-soft">{activity.dist}</span>
        {hasDetail && <ChevronIcon expanded={expanded} className="h-3.5 w-3.5 shrink-0 text-ink-soft" />}
      </span>
    </span>
  );

  return (
    <motion.li variants={itemVariants} className="list-none">
      {/* Opacity for filter-dimming lives on this inner element, not the motion.li above: whileInView/variants and animate both target opacity, and Framer Motion resolves whileInView above animate, so a variants-driven li could never dim once it had scrolled into view. See the equivalent note in StopCard. */}
      <motion.div
        animate={{ opacity: dimmed ? 0.4 : 1 }}
        transition={dimTransition}
        className={`flex items-stretch overflow-hidden rounded-lg border border-ink/10 bg-white/50 text-sm text-ink ${activity.daytrip ? "text-ink-soft" : ""}`}
      >
        <span aria-hidden className={`w-1 shrink-0 ${barClassName}`} />
        <div className="min-w-0 flex-1 px-3 py-2">
          {hasDetail ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              aria-expanded={expanded}
              className="w-full rounded-lg text-left outline-none"
            >
              {row}
            </button>
          ) : (
            row
          )}

          <AnimatePresence initial={false}>
            {hasDetail && expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={dimTransition}
                className="overflow-hidden"
              >
                <div className="mt-2 flex gap-3 pb-1 pl-1">
                  {hasPhoto && (
                    <img src={activity.photos?.[0]} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />
                  )}
                  {activity.description && (
                    <p className="text-xs not-italic leading-relaxed text-ink-soft">{activity.description}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.li>
  );
}

function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""} ${className ?? ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
