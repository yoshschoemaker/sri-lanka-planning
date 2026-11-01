import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGuideProgress, practiceDeck, type GuideProgress } from "./guideProgress";

const words = [{ id: "a" }, { id: "b" }, { id: "c" }];

function stubStorage(value: string | null) {
  vi.stubGlobal("window", { localStorage: { getItem: () => value, setItem: () => {} } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("practiceDeck", () => {
  it("zet oefenwoorden voor nieuwe en laat gekende weg", () => {
    const progress: GuideProgress = { words: { a: "known", c: "practice" }, readTips: [] };
    expect(practiceDeck(words, progress).map((w) => w.id)).toEqual(["c", "b"]);
  });

  it("herhaalt alles zodra alles gekend is", () => {
    const progress: GuideProgress = { words: { a: "known", b: "known", c: "known" }, readTips: [] };
    expect(practiceDeck(words, progress)).toHaveLength(3);
  });
});

describe("loadGuideProgress", () => {
  it("geeft lege voortgang zonder opgeslagen data", () => {
    stubStorage(null);
    expect(loadGuideProgress()).toEqual({ words: {}, readTips: [] });
  });

  it("negeert onzin in opgeslagen data", () => {
    stubStorage(JSON.stringify({ words: { a: "known", b: "huh" }, readTips: ["x", 3] }));
    expect(loadGuideProgress()).toEqual({ words: { a: "known" }, readTips: ["x"] });
  });

  it("overleeft kapotte JSON", () => {
    stubStorage("{nope");
    expect(loadGuideProgress()).toEqual({ words: {}, readTips: [] });
  });
});
