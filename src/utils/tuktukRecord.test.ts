import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTuktukRecord, withRide } from "./tuktukRecord";

function stubStorage(value: string | null) {
  vi.stubGlobal("window", { localStorage: { getItem: () => value, setItem: () => {} } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("withRide", () => {
  const record = { best: 500, distance: 480, reachedStop: "Sigiriya", games: 3 };

  it("telt een mindere rit alleen mee", () => {
    expect(withRide(record, { score: 200, distance: 190, reachedStop: "Negombo" })).toEqual({ ...record, games: 4 });
  });

  it("onthoudt een nieuw record met waar je kwam", () => {
    expect(withRide(record, { score: 900, distance: 850, reachedStop: "Kandy" })).toEqual({
      best: 900,
      distance: 850,
      reachedStop: "Kandy",
      games: 4,
    });
  });
});

describe("loadTuktukRecord", () => {
  it("begint leeg zonder opgeslagen data of bij rommel", () => {
    stubStorage(null);
    expect(loadTuktukRecord().best).toBe(0);
    stubStorage("{kapot");
    expect(loadTuktukRecord().best).toBe(0);
    stubStorage(JSON.stringify({ best: -4, games: "veel" }));
    expect(loadTuktukRecord()).toEqual({ best: 0, distance: 0, reachedStop: null, games: 0 });
  });
});
