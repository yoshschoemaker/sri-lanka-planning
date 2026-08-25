import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "srilanka-trip:checklist-done";

/**
 * Welke checklist-items afgevinkt zijn, bewaard in localStorage.
 *
 * Bewust niet in content/trip.json: dat is de gedeelde planning die via git
 * gaat, en "visum aangevraagd" wil je kunnen aantikken zonder een commit. Wel
 * daarmee per apparaat: wie op twee toestellen kijkt, ziet twee lijstjes.
 *
 * De sleutels komen uit ChecklistItem.key en zijn afgeleid van de tekst of het
 * stop-id, niet van de positie in de lijst, zodat een herordening in de JSON de
 * vinkjes niet verschuift.
 */

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((key): key is string => typeof key === "string")) : new Set();
  } catch {
    // Onleesbare of geblokkeerde opslag (privémodus, quota, kapotte JSON): dan
    // begint de lijst leeg in plaats van dat de sectie omvalt.
    return new Set();
  }
}

function write(keys: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Niet kunnen opslaan is jammer maar niet fataal; de vinkjes gelden dan
    // alleen voor deze sessie.
  }
}

export interface ChecklistProgress {
  isDone: (key: string) => boolean;
  toggle: (key: string) => void;
  /** Aantal afgevinkte items uit `keys`, dus zonder items die niet meer bestaan. */
  doneCount: (keys: string[]) => number;
  clear: () => void;
}

export function useChecklistProgress(): ChecklistProgress {
  const [done, setDone] = useState<Set<string>>(read);

  // Een tweede tabblad (of hetzelfde toestel in een tweede venster) hoort niet
  // met een verouderd lijstje verder te gaan.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setDone(read());
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggle = useCallback((key: string) => {
    setDone((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setDone(() => {
      const empty = new Set<string>();
      write(empty);
      return empty;
    });
  }, []);

  const isDone = useCallback((key: string) => done.has(key), [done]);

  const doneCount = useCallback((keys: string[]) => keys.filter((key) => done.has(key)).length, [done]);

  return { isDone, toggle, doneCount, clear };
}
