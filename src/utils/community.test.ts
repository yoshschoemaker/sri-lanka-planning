import { describe, expect, it } from "vitest";
import {
  applyPending,
  consensusPriority,
  EMPTY_SNAPSHOT,
  enqueue,
  suggestionKey,
  type PendingOp,
  type Reaction,
  type Suggestion,
} from "./community";

const ME = "user-me";
const OTHER = "user-other";

function suggestion(id: string, userId = OTHER): Suggestion {
  return { id, stopId: "ella", title: `Voorstel ${id}`, description: null, url: null, userId, createdAt: "2026-11-01T10:00:00Z" };
}

function reaction(activityKey: string, userId: string, overrides: Partial<Reaction> = {}): Reaction {
  return { activityKey, userId, thumbsUp: false, priority: null, ...overrides };
}

describe("enqueue", () => {
  it("houdt per activiteit alleen de laatste reactie", () => {
    let queue: PendingOp[] = [];
    queue = enqueue(queue, { kind: "reaction", activityKey: "trip:ella/a", thumbsUp: true, priority: null });
    queue = enqueue(queue, { kind: "reaction", activityKey: "trip:ella/b", thumbsUp: true, priority: null });
    queue = enqueue(queue, { kind: "reaction", activityKey: "trip:ella/a", thumbsUp: false, priority: "must" });

    expect(queue).toEqual([
      { kind: "reaction", activityKey: "trip:ella/b", thumbsUp: true, priority: null },
      { kind: "reaction", activityKey: "trip:ella/a", thumbsUp: false, priority: "must" },
    ]);
  });

  it("laat een onverstuurd voorstel dat weer weg moet helemaal verdwijnen", () => {
    const { userId: _, ...pending } = suggestion("s1", ME);
    let queue: PendingOp[] = [];
    queue = enqueue(queue, { kind: "add-suggestion", suggestion: pending });
    queue = enqueue(queue, { kind: "reaction", activityKey: suggestionKey("s1"), thumbsUp: true, priority: null });
    queue = enqueue(queue, { kind: "delete-suggestion", id: "s1" });

    expect(queue).toEqual([]);
  });

  it("verstuurt het verwijderen van een voorstel dat al op de server staat", () => {
    const queue = enqueue([], { kind: "delete-suggestion", id: "s1" });
    expect(queue).toEqual([{ kind: "delete-suggestion", id: "s1" }]);
  });
});

describe("applyPending", () => {
  it("toont eigen handelingen bovenop de serverstand", () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      suggestions: [suggestion("s1")],
      reactions: [reaction("trip:ella/a", ME, { thumbsUp: true }), reaction("trip:ella/a", OTHER, { thumbsUp: true })],
    };
    const { userId: _, ...pending } = suggestion("s2", ME);
    const queue: PendingOp[] = [
      { kind: "add-suggestion", suggestion: pending },
      { kind: "reaction", activityKey: "trip:ella/a", thumbsUp: false, priority: null },
    ];

    const result = applyPending(snapshot, queue, ME);

    expect(result.suggestions.map((s) => [s.id, s.userId])).toEqual([
      ["s1", OTHER],
      ["s2", ME],
    ]);
    // Duimpje en prioriteit allebei weg: geen lege rij laten staan.
    expect(result.reactions).toEqual([reaction("trip:ella/a", OTHER, { thumbsUp: true })]);
  });

  it("haalt een verwijderd voorstel en de reacties erop weg", () => {
    const snapshot = {
      ...EMPTY_SNAPSHOT,
      suggestions: [suggestion("s1", ME)],
      reactions: [reaction(suggestionKey("s1"), OTHER, { thumbsUp: true })],
    };
    const result = applyPending(snapshot, [{ kind: "delete-suggestion", id: "s1" }], ME);
    expect(result.suggestions).toEqual([]);
    expect(result.reactions).toEqual([]);
  });

  it("dubbelt een voorstel niet zodra de server het al terugstuurt", () => {
    const snapshot = { ...EMPTY_SNAPSHOT, suggestions: [suggestion("s1", ME)] };
    const { userId: _, ...pending } = suggestion("s1", ME);
    const result = applyPending(snapshot, [{ kind: "add-suggestion", suggestion: pending }], ME);
    expect(result.suggestions).toHaveLength(1);
  });
});

describe("consensusPriority", () => {
  it("kiest wat het vaakst gekozen is", () => {
    const reactions = [
      reaction("k", "a", { priority: "maybe" }),
      reaction("k", "b", { priority: "maybe" }),
      reaction("k", "c", { priority: "must" }),
    ];
    expect(consensusPriority(reactions)).toBe("maybe");
  });

  it("laat bij gelijkspel de hoogste winnen", () => {
    const reactions = [reaction("k", "a", { priority: "maybe" }), reaction("k", "b", { priority: "must" })];
    expect(consensusPriority(reactions)).toBe("must");
  });

  it("geeft null zonder prioriteiten", () => {
    expect(consensusPriority([reaction("k", "a", { thumbsUp: true })])).toBeNull();
  });
});
