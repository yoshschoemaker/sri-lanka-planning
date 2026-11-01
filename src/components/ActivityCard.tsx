import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Activity, ActivityPriority } from "../types/trip";
import type { Reaction } from "../utils/community";
import { dimTransition } from "../motion/variants";
import { Photo } from "./Photo";
import { ChevronIcon, ThumbUpIcon, TrashIcon } from "./icons";
import { PHOTO_SIZES } from "../utils/photos";
import { hasTextSelection } from "../utils/textSelection";

/** Alles voor de gedeelde reacties op deze activiteit. Afwezig als de gedeelde functies uit staan. */
export interface ActivityCommunity {
  reactions: Reaction[];
  usernames: Record<string, string>;
  userId: string | null;
  isMember: boolean;
  onReact: (next: { thumbsUp: boolean; priority: ActivityPriority | null }) => void;
  /** Voor wie nog geen lid is en toch op het duimpje tikt. */
  onRequestJoin: () => void;
  /** Alleen bij een voorstel van een reisgenoot. */
  suggestedBy?: string;
  url?: string | null;
  /** Alleen bij je eigen voorstel. */
  onDelete?: () => void;
}

interface ActivityCardProps {
  activity: Activity;
  dimmed?: boolean;
  community?: ActivityCommunity;
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

const PRIORITY_KEYS: ActivityPriority[] = ["must", "nice", "maybe"];

/** De uitklap onder een activiteit: je eigen prioriteit en wat de rest ervan vindt. */
function CommunityPanel({ community }: { community: ActivityCommunity }) {
  const { reactions, usernames, userId, isMember, onReact, onRequestJoin, suggestedBy, url, onDelete } = community;
  const mine = reactions.find((r) => r.userId === userId);
  const others = reactions.filter((r) => r.userId !== userId && (r.thumbsUp || r.priority));

  return (
    <div className="mt-2 space-y-2.5 border-t border-ink/10 pb-1 pt-2.5 text-xs not-italic">
      {(suggestedBy || url) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
          {suggestedBy && <span>Voorgesteld door {suggestedBy}</span>}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-terracotta-dark underline underline-offset-2"
            >
              Meer info
            </a>
          )}
        </p>
      )}

      {isMember ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Jouw prioriteit">
          <span className="mr-1 text-ink-soft">Jij:</span>
          {PRIORITY_KEYS.map((key) => {
            const active = mine?.priority === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact({ thumbsUp: mine?.thumbsUp ?? false, priority: active ? null : key });
                }}
                className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                  active ? PRIORITY_CONFIG[key].badgeClassName : "border border-ink/15 text-ink-soft hover:bg-ink/5"
                }`}
              >
                {PRIORITY_CONFIG[key].label}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestJoin();
          }}
          className="font-medium text-terracotta-dark underline underline-offset-2"
        >
          Doe mee om je eigen prioriteit te kiezen
        </button>
      )}

      {others.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Wat de anderen vinden">
          {others.map((r) => (
            <li key={r.userId} className="flex items-center gap-1 rounded-full bg-white/70 py-0.5 pl-2 pr-1 text-ink">
              {usernames[r.userId] ?? "Iemand"}
              {r.thumbsUp && <ThumbUpIcon filled className="h-3 w-3 text-terracotta-dark" />}
              {r.priority ? <PriorityBadge priority={r.priority} /> : <span className="w-1" />}
            </li>
          ))}
        </ul>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm("Dit voorstel verwijderen?")) onDelete();
          }}
          className="inline-flex items-center gap-1 font-medium text-ink-soft hover:text-terracotta-dark"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          Verwijderen
        </button>
      )}
    </div>
  );
}

/** Het duimpje rechts op de kaart: "goed idee, ik wil mee", met het aantal. */
function ThumbButton({ community, name }: { community: ActivityCommunity; name: string }) {
  const { reactions, userId, isMember, onReact, onRequestJoin } = community;
  const mine = reactions.find((r) => r.userId === userId);
  const count = reactions.filter((r) => r.thumbsUp).length;
  const pressed = mine?.thumbsUp ?? false;

  return (
    <button
      type="button"
      aria-pressed={isMember ? pressed : undefined}
      aria-label={`Goed idee: ${name}, ${count} ${count === 1 ? "duimpje" : "duimpjes"}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!isMember) onRequestJoin();
        else onReact({ thumbsUp: !pressed, priority: mine?.priority ?? null });
      }}
      className={`flex shrink-0 items-center gap-1 self-start rounded-lg px-3 py-2 text-xs font-medium transition-colors active:scale-95 ${
        pressed ? "text-terracotta-dark" : "text-ink-soft hover:text-ink"
      }`}
    >
      <ThumbUpIcon filled={pressed} className="h-4 w-4" />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

/** A thin strip card per activity (rather than a plain bulleted row), so the priority label and distance both read at a glance. */
export function ActivityCard({ activity, dimmed = false, community }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasPhoto = Boolean(activity.photos && activity.photos.length > 0);
  const hasDetail = Boolean(activity.description) || hasPhoto || Boolean(community);
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
            // Zelfde opbouw als de stopnaam in StopCard: de knop ligt onder de
            // tekst in plaats van eromheen, zodat de naam met de muis te
            // selecteren blijft. Een klik op de tekst klapt open via deze div.
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (!hasTextSelection()) setExpanded((prev) => !prev);
              }}
              className="relative cursor-pointer"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((prev) => !prev);
                }}
                aria-expanded={expanded}
                aria-label={[activity.name, activity.priority && PRIORITY_CONFIG[activity.priority].label, activity.dist]
                  .filter(Boolean)
                  .join(", ")}
                className="absolute inset-0 rounded-lg outline-none"
              />
              <span aria-hidden className="relative block">
                {row}
              </span>
            </div>
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
                {(hasPhoto || activity.description) && (
                <div className="mt-2 flex gap-3 pb-1 pl-1">
                  {hasPhoto && (
                    <Photo
                      path={activity.photos?.[0]}
                      alt=""
                      sizes={PHOTO_SIZES.activityThumb}
                      className="h-14 w-20 shrink-0 rounded-md object-cover"
                    />
                  )}
                  {activity.description && (
                    <p className="text-xs not-italic leading-relaxed text-ink-soft">{activity.description}</p>
                  )}
                </div>
                )}
                {community && <CommunityPanel community={community} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {community && <ThumbButton community={community} name={activity.name} />}
      </motion.div>
    </motion.li>
  );
}
