import type { ActivityPriority } from "../types/trip";

/**
 * Pure logica achter de gedeelde activiteiten: voorstellen van reisgenoten,
 * duimpjes en ieders eigen prioriteit. De database staat in Supabase (zie
 * supabase/schema.sql), het netwerkdeel in communityApi.ts en de React-staat
 * in CommunityProvider. Hier staat alleen wat zonder netwerk te testen is.
 *
 * Wat je zelf doet gaat eerst in een wachtrij en is meteen zichtbaar; de
 * wachtrij wordt verstuurd zodra er verbinding is. In het binnenland is dat
 * niet altijd meteen.
 */

export interface Suggestion {
  id: string;
  /** stops[].id uit content/trip.json. */
  stopId: string;
  title: string;
  description: string | null;
  url: string | null;
  userId: string;
  createdAt: string;
}

export interface Reaction {
  activityKey: string;
  userId: string;
  thumbsUp: boolean;
  priority: ActivityPriority | null;
}

/** Een gereden rondje Tuktuk leren rijden. Alleen een nieuw eigen record wordt verstuurd. */
export interface Score {
  id: string;
  userId: string;
  score: number;
  /** Afgelegde meters. */
  distance: number;
  /** Naam van de laatst gehaalde stop. */
  reachedStop: string | null;
  createdAt: string;
}

export interface CommunitySnapshot {
  suggestions: Suggestion[];
  reactions: Reaction[];
  scores: Score[];
  /** user_id → naam, van iedereen die lid is. */
  usernames: Record<string, string>;
}

export const EMPTY_SNAPSHOT: CommunitySnapshot = { suggestions: [], reactions: [], scores: [], usernames: {} };

export type PendingOp =
  | { kind: "reaction"; activityKey: string; thumbsUp: boolean; priority: ActivityPriority | null }
  | { kind: "add-suggestion"; suggestion: Omit<Suggestion, "userId"> }
  | { kind: "delete-suggestion"; id: string }
  | { kind: "add-score"; score: Omit<Score, "userId"> };

/** Sleutel voor een activiteit uit trip.json. Moet passen op de check in schema.sql. */
export function tripActivityKey(stopId: string, activityId: string): string {
  return `trip:${stopId}/${activityId}`;
}

export function suggestionKey(id: string): string {
  return `suggestion:${id}`;
}

/**
 * Zet een handeling in de wachtrij en houdt die zo kort mogelijk: vijf keer op
 * het duimpje tikken onderweg hoeft niet als vijf verzoeken achteraf. Een
 * voorstel dat nog niet verstuurd was en weer weggehaald wordt, verdwijnt
 * helemaal, inclusief de reacties erop.
 */
export function enqueue(queue: PendingOp[], op: PendingOp): PendingOp[] {
  if (op.kind === "reaction") {
    return [...queue.filter((q) => !(q.kind === "reaction" && q.activityKey === op.activityKey)), op];
  }
  if (op.kind === "delete-suggestion") {
    const key = suggestionKey(op.id);
    const wasPending = queue.some((q) => q.kind === "add-suggestion" && q.suggestion.id === op.id);
    const rest = queue.filter(
      (q) =>
        !(q.kind === "add-suggestion" && q.suggestion.id === op.id) &&
        !(q.kind === "reaction" && q.activityKey === key),
    );
    return wasPending ? rest : [...rest, op];
  }
  return [...queue, op];
}

/** De laatst bekende serverstand met je eigen nog niet verstuurde handelingen erbovenop. */
export function applyPending(snapshot: CommunitySnapshot, queue: PendingOp[], userId: string | null): CommunitySnapshot {
  if (queue.length === 0 || !userId) return snapshot;
  let { suggestions, reactions, scores } = snapshot;

  for (const op of queue) {
    if (op.kind === "add-score") {
      if (!scores.some((s) => s.id === op.score.id)) scores = [...scores, { ...op.score, userId }];
    } else if (op.kind === "add-suggestion") {
      if (!suggestions.some((s) => s.id === op.suggestion.id)) {
        suggestions = [...suggestions, { ...op.suggestion, userId }];
      }
    } else if (op.kind === "delete-suggestion") {
      const key = suggestionKey(op.id);
      suggestions = suggestions.filter((s) => s.id !== op.id);
      reactions = reactions.filter((r) => r.activityKey !== key);
    } else {
      reactions = reactions.filter((r) => !(r.activityKey === op.activityKey && r.userId === userId));
      if (op.thumbsUp || op.priority) {
        reactions = [...reactions, { activityKey: op.activityKey, userId, thumbsUp: op.thumbsUp, priority: op.priority }];
      }
    }
  }

  return { ...snapshot, suggestions, reactions, scores };
}

export function groupReactions(reactions: Reaction[]): Map<string, Reaction[]> {
  const byKey = new Map<string, Reaction[]>();
  for (const reaction of reactions) {
    const list = byKey.get(reaction.activityKey);
    if (list) list.push(reaction);
    else byKey.set(reaction.activityKey, [reaction]);
  }
  return byKey;
}

const PRIORITY_RANK: Record<ActivityPriority, number> = { must: 3, nice: 2, maybe: 1 };

/**
 * Wat de groep van een activiteit vindt: de prioriteit die het vaakst gekozen
 * is. Bij gelijkspel wint de hoogste, zodat één "must" tegenover één
 * "misschien" niet wegzakt.
 */
export function consensusPriority(reactions: Reaction[]): ActivityPriority | null {
  const counts = new Map<ActivityPriority, number>();
  for (const { priority } of reactions) {
    if (priority) counts.set(priority, (counts.get(priority) ?? 0) + 1);
  }
  let best: ActivityPriority | null = null;
  for (const [priority, count] of counts) {
    const bestCount = best ? (counts.get(best) ?? 0) : 0;
    if (!best || count > bestCount || (count === bestCount && PRIORITY_RANK[priority] > PRIORITY_RANK[best])) {
      best = priority;
    }
  }
  return best;
}

/** Nieuwste eerst is voor een prikbord logisch, maar in een lijst om uit te kiezen wil je de volgorde vast: oudste eerst. */
export function suggestionsForStop(suggestions: Suggestion[], stopId: string): Suggestion[] {
  return suggestions
    .filter((s) => s.stopId === stopId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  distance: number;
  reachedStop: string | null;
}

/** Beste rit per persoon, hoogste bovenaan. Bij gelijke stand staat wie het eerst haalde boven. */
export function leaderboard(scores: Score[], usernames: Record<string, string>): LeaderboardEntry[] {
  const best = new Map<string, Score>();
  for (const s of scores) {
    const current = best.get(s.userId);
    if (!current || s.score > current.score || (s.score === current.score && s.createdAt < current.createdAt)) {
      best.set(s.userId, s);
    }
  }
  return [...best.values()]
    .filter((s) => usernames[s.userId] !== undefined)
    .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
    .map((s) => ({
      userId: s.userId,
      username: usernames[s.userId],
      score: s.score,
      distance: s.distance,
      reachedStop: s.reachedStop,
    }));
}

export function bestScoreOf(scores: Score[], userId: string | null): number {
  if (!userId) return 0;
  return scores.reduce((best, s) => (s.userId === userId && s.score > best ? s.score : best), 0);
}
