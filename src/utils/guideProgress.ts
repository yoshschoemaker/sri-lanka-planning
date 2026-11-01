import { useCallback, useState } from "react";

/** Versie in de sleutel: verandert de vorm, dan begint iedereen schoon in plaats van met half kapotte data. */
const STORAGE_KEY = "srilanka-trip:guide:v1";

export type WordStatus = "practice" | "known";

export interface GuideProgress {
  /** Per woord-id. Ontbreekt een woord, dan is het nog nieuw. */
  words: Record<string, WordStatus>;
  /** Tip-ids die als gelezen zijn afgevinkt. */
  readTips: string[];
}

const EMPTY: GuideProgress = { words: {}, readTips: [] };

/** Leest de voortgang, en valt bij elke twijfel terug op leeg: voortgang kwijt is jammer, een gecrashte Gids is erger. */
export function loadGuideProgress(): GuideProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<GuideProgress>;
    const words: Record<string, WordStatus> = {};
    for (const [id, status] of Object.entries(parsed.words ?? {})) {
      if (status === "practice" || status === "known") words[id] = status;
    }
    const readTips = Array.isArray(parsed.readTips) ? parsed.readTips.filter((id) => typeof id === "string") : [];
    return { words, readTips };
  } catch {
    return EMPTY;
  }
}

function saveGuideProgress(progress: GuideProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Opslag kan ontbreken (privévenster, vol). De Gids werkt dan gewoon, alleen zonder geheugen.
  }
}

/**
 * Volgorde van een oefenronde: eerst wat je nog oefent, dan wat nieuw is.
 * Gekende woorden doen niet mee, tenzij alles gekend is; dan herhaal je alles.
 */
export function practiceDeck<T extends { id: string }>(words: readonly T[], progress: GuideProgress): T[] {
  const practice = words.filter((w) => progress.words[w.id] === "practice");
  const fresh = words.filter((w) => !progress.words[w.id]);
  const deck = [...practice, ...fresh];
  return deck.length > 0 ? deck : [...words];
}

export function useGuideProgress() {
  const [progress, setProgress] = useState<GuideProgress>(loadGuideProgress);

  const update = useCallback((change: (current: GuideProgress) => GuideProgress) => {
    setProgress((current) => {
      const next = change(current);
      saveGuideProgress(next);
      return next;
    });
  }, []);

  const setWordStatus = useCallback(
    (id: string, status: WordStatus | null) =>
      update((current) => {
        const words = { ...current.words };
        if (status) words[id] = status;
        else delete words[id];
        return { ...current, words };
      }),
    [update],
  );

  const toggleTipRead = useCallback(
    (id: string) =>
      update((current) => ({
        ...current,
        readTips: current.readTips.includes(id)
          ? current.readTips.filter((tipId) => tipId !== id)
          : [...current.readTips, id],
      })),
    [update],
  );

  const reset = useCallback(() => update(() => EMPTY), [update]);

  return { progress, setWordStatus, toggleTipRead, reset };
}
