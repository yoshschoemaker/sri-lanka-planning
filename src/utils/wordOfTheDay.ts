const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Kleine deterministische PRNG (mulberry32): dezelfde seed geeft op elk toestel dezelfde reeks. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledIndices(length: number, seed: number): number[] {
  const random = seededRandom(seed);
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/** Dagnummer van de lokale kalenderdag, zodat het woord om middernacht wisselt en niet om 01:00 UTC. */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/**
 * Kiest het woord van de dag. Willekeurig, maar wel eerlijk: elke ronde van
 * `words.length` dagen komt elk woord precies één keer langs, in een per ronde
 * andere volgorde. Alles hangt af van de datum, dus iedereen in de groep ziet
 * dezelfde dag hetzelfde woord.
 */
export function wordOfTheDay<T>(words: readonly T[], now: Date = new Date()): T {
  const day = localDayNumber(now);
  const round = Math.floor(day / words.length);
  const order = shuffledIndices(words.length, round);
  return words[order[day % words.length]];
}
