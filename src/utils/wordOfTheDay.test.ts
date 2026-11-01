import { describe, expect, it } from "vitest";
import { wordOfTheDay } from "./wordOfTheDay";
import { dailyWords } from "../data/guideContent";

describe("wordOfTheDay", () => {
  it("geeft de hele dag hetzelfde woord", () => {
    const morning = wordOfTheDay(dailyWords, new Date(2026, 10, 1, 0, 5));
    const evening = wordOfTheDay(dailyWords, new Date(2026, 10, 1, 23, 55));
    expect(evening).toBe(morning);
  });

  it("laat in elke ronde elk woord precies één keer langs", () => {
    const n = dailyWords.length;
    // Begin op het eerste dagnummer van een ronde.
    const firstDay = Math.ceil(Date.UTC(2026, 10, 1) / 86_400_000 / n) * n;
    for (let round = 0; round < 3; round++) {
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) {
        const utc = new Date((firstDay + round * n + i) * 86_400_000);
        const local = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12);
        seen.add(wordOfTheDay(dailyWords, local).id);
      }
      expect(seen.size).toBe(n);
    }
  });

  it("bevat hallo, goedendag en bier", () => {
    const ids = dailyWords.map((w) => w.id);
    expect(ids).toEqual(expect.arrayContaining(["ayubowan", "suba-dawasak", "biyar-ekak"]));
    expect(new Set(ids).size).toBe(dailyWords.length);
    expect(dailyWords).toHaveLength(20);
  });
});
