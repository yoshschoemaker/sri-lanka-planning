import { useEffect, useState } from "react";
import type { Activity, ActivityPriority, Stop } from "../types/trip";
import type { PriorityFilter } from "./FilterBar";
import { ActivityCard, type ActivityCommunity } from "./ActivityCard";
import { JoinSheet } from "./JoinSheet";
import { SuggestSheet } from "./SuggestSheet";
import { PlusIcon, UsersIcon } from "./icons";
import { nightsLabel } from "../utils/nights";
import { consensusPriority, suggestionKey, suggestionsForStop, tripActivityKey } from "../utils/community";
import { useCommunity, type CommunityValue } from "../utils/communityContext";

const PRIORITY_OPTIONS: { key: ActivityPriority; label: string }[] = [
  { key: "must", label: "Must see/do" },
  { key: "nice", label: "Leuk idee" },
  { key: "maybe", label: "Misschien" },
];

interface ActivitiesViewProps {
  stops: Stop[];
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (value: PriorityFilter) => void;
}

interface ListedActivity {
  key: string;
  activity: Activity;
  community?: ActivityCommunity;
}

/**
 * De activiteiten van één stop: eerst die uit trip.json, daarna de voorstellen
 * van reisgenoten. Een voorstel heeft geen vaste prioriteit; het krijgt die
 * van de groep, zodat de prioriteitsfilter er ook op werkt.
 */
function listActivities(stop: Stop, community: CommunityValue, onRequestJoin: () => void): ListedActivity[] {
  const { enabled, snapshot, reactionsByKey, userId, username, setReaction, deleteSuggestion } = community;
  const shared = (key: string): ActivityCommunity => ({
    reactions: reactionsByKey.get(key) ?? [],
    usernames: snapshot.usernames,
    userId,
    isMember: username !== null,
    onReact: (next) => setReaction(key, next),
    onRequestJoin,
  });

  const fromTrip = stop.activities.map((activity) => {
    const key = tripActivityKey(stop.id, activity.id);
    return { key, activity, community: enabled ? shared(key) : undefined };
  });
  if (!enabled) return fromTrip;

  const suggested = suggestionsForStop(snapshot.suggestions, stop.id).map((suggestion) => {
    const key = suggestionKey(suggestion.id);
    const suggestedBy = snapshot.usernames[suggestion.userId] ?? "een reisgenoot";
    return {
      key,
      activity: {
        id: suggestion.id,
        name: suggestion.title,
        dist: `van ${suggestedBy}`,
        description: suggestion.description ?? undefined,
        priority: consensusPriority(reactionsByKey.get(key) ?? []) ?? undefined,
      },
      community: {
        ...shared(key),
        suggestedBy,
        url: suggestion.url,
        onDelete: suggestion.userId === userId ? () => deleteSuggestion(suggestion.id) : undefined,
      },
    };
  });
  return [...fromTrip, ...suggested];
}

/** Bovenaan de pagina: wie je bent in de groep, of hoe je meedoet. */
function CommunityBar({ community, onOpenJoin }: { community: CommunityValue; onOpenJoin: () => void }) {
  const { username, pendingCount, syncState, syncError } = community;

  if (username === null) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/60 px-4 py-3">
        <p className="flex min-w-0 items-start gap-2 text-sm text-ink-soft">
          <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-dark" />
          <span>Reisgenoten kunnen hier activiteiten voorstellen en stemmen. Doe mee met de groepscode.</span>
        </p>
        <button
          type="button"
          onClick={onOpenJoin}
          className="shrink-0 rounded-full bg-terracotta-dark px-4 py-1.5 text-sm font-semibold text-cream transition hover:bg-terracotta active:scale-95"
        >
          Meedoen
        </button>
      </div>
    );
  }

  const status =
    syncState === "error" && syncError
      ? syncError
      : pendingCount > 0
        ? syncState === "offline"
          ? `${pendingCount} ${pendingCount === 1 ? "wijziging wacht" : "wijzigingen wachten"} op verbinding`
          : "Versturen…"
        : null;

  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft" aria-live="polite">
      <UsersIcon className="h-3.5 w-3.5 shrink-0" />
      <span>
        Je doet mee als{" "}
        <button type="button" onClick={onOpenJoin} className="font-medium text-ink underline underline-offset-2">
          {username}
        </button>
      </span>
      {status && <span className={syncState === "error" ? "text-terracotta-dark" : ""}>· {status}</span>}
    </p>
  );
}

/**
 * Alle activiteiten per bestemming, in de volgorde van de route. Anders dan op
 * de routepagina verbergt de prioriteitsfilter hier wat niet past in plaats
 * van het te dimmen: dit is een lijst om uit te kiezen, de vorm van de route
 * hoeft hier niet bewaard te blijven.
 */
export function ActivitiesView({ stops, priorityFilter, onPriorityFilterChange }: ActivitiesViewProps) {
  const community = useCommunity();
  const { enabled, refresh } = community;
  const isMember = community.username !== null;
  const [joinOpen, setJoinOpen] = useState(false);
  const [suggestFor, setSuggestFor] = useState<Stop | null>(null);

  // Wie naar Doen gaat, wil zien wat er sinds de vorige keer bij is gekomen.
  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const allSections = stops.map((stop, i) => ({
    stop,
    order: i + 1,
    activities: listActivities(stop, community, () => setJoinOpen(true)),
  }));
  // Leden zien onder "Alles" ook stops zonder activiteiten, om daar iets voor
  // te kunnen stellen.
  const showEmpty = isMember && priorityFilter === "all";
  const sections = allSections
    .map((section) => ({
      ...section,
      activities: section.activities.filter(
        ({ activity }) => priorityFilter === "all" || activity.priority === priorityFilter,
      ),
    }))
    .filter((section) => showEmpty || section.activities.length > 0);
  const shown = sections.reduce((sum, section) => sum + section.activities.length, 0);
  const total = allSections.reduce((sum, section) => sum + section.activities.length, 0);

  return (
    <div className="pt-safe">
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="font-serif text-sm font-semibold uppercase tracking-[0.35em] text-terracotta-dark">Activiteiten</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">Doen</h1>
        <p className="mt-2 text-base text-ink-soft">Alles wat we willen zien en doen, per bestemming.</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-full border border-ink/15 bg-white/60 p-1">
            <button
              type="button"
              aria-pressed={priorityFilter === "all"}
              onClick={() => onPriorityFilterChange("all")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                priorityFilter === "all" ? "bg-ink text-cream" : "text-ink-soft hover:bg-ink/5"
              }`}
            >
              Alles
            </button>
            {PRIORITY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={priorityFilter === option.key}
                onClick={() => onPriorityFilterChange(priorityFilter === option.key ? "all" : option.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  priorityFilter === option.key ? "bg-terracotta-dark text-white" : "text-ink-soft hover:bg-ink/5"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-ink-soft" aria-live="polite">
            {shown === total ? `${total} activiteiten` : `${shown} van ${total} activiteiten`}
          </p>
        </div>

        {enabled && <CommunityBar community={community} onOpenJoin={() => setJoinOpen(true)} />}

        {sections.map(({ stop, order, activities }) => (
          <section key={stop.id} id={`doen-${stop.id}`} aria-labelledby={`doen-${stop.id}-title`} className="mt-8 scroll-mt-6">
            <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-ink/10 bg-cream/95 px-1 py-2.5 backdrop-blur-sm">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full bg-sand text-xs font-semibold text-ink"
              >
                {order}
              </span>
              <h2 id={`doen-${stop.id}-title`} className="font-serif text-xl font-semibold text-ink">
                {stop.name}
              </h2>
              <span className="ml-auto shrink-0 text-xs text-ink-soft">
                {stop.dates} · {nightsLabel(stop)}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {activities.map(({ key, activity, community: shared }) => (
                <ActivityCard key={key} activity={activity} community={shared} />
              ))}
            </ul>
            {isMember && (
              <button
                type="button"
                onClick={() => setSuggestFor(stop)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-terracotta-dark transition-colors hover:bg-terracotta/10"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Activiteit voorstellen
              </button>
            )}
          </section>
        ))}

        {sections.length === 0 && (
          <p className="mt-10 text-center text-sm text-ink-soft">Geen activiteiten met deze prioriteit.</p>
        )}
      </main>

      {enabled && (
        <>
          <JoinSheet open={joinOpen} onClose={() => setJoinOpen(false)} />
          <SuggestSheet stop={suggestFor} onClose={() => setSuggestFor(null)} />
        </>
      )}
    </div>
  );
}
