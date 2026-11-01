import { describe, expect, it } from "vitest";
import {
  createGame,
  drainEvents,
  feed,
  isObstacle,
  LANES,
  routeFromStops,
  score,
  SEGMENT,
  steer,
  step,
  type GameState,
  type RouteStop,
} from "./engine";

const route: RouteStop[] = [
  { id: "negombo", name: "Negombo", biome: "coast" },
  { id: "sigiriya", name: "Sigiriya", biome: "cultural" },
  { id: "ella", name: "Ella", biome: "hill" },
  { id: "yala", name: "Yala", biome: "south" },
];

const DT = 1 / 120;

/** Een lege weg, zodat een test zelf bepaalt wat er staat. */
function emptyRoad(): GameState {
  const state = createGame(route, 1);
  state.spawnCursor = Number.POSITIVE_INFINITY;
  state.nextElephantAt = Number.POSITIVE_INFINITY;
  return state;
}

function run(state: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += DT) step(state, DT);
}

describe("routeFromStops", () => {
  it("laat de dubbele Negombo aan het eind weg en vertaalt regio's", () => {
    const result = routeFromStops([
      { id: "a", name: "Negombo" },
      { id: "b", name: "Kandy", region: "hill-country" },
      { id: "c", name: "Negombo" },
    ]);
    expect(result).toEqual([
      { id: "a", name: "Negombo", biome: "coast" },
      { id: "b", name: "Kandy", biome: "hill" },
    ]);
  });
});

describe("rijden", () => {
  it("rijdt vooruit, versnelt en meldt elke nieuwe stop", () => {
    const state = emptyRoad();
    const startSpeed = state.speed;
    const stops: string[] = [];
    while (state.distance < SEGMENT * 2 + 1) {
      step(state, DT);
      for (const e of drainEvents(state)) if (e.type === "stop") stops.push(e.name);
    }
    expect(stops).toEqual(["Sigiriya", "Ella"]);
    expect(state.speed).toBeGreaterThan(startSpeed);
    expect(score(state)).toBe(Math.floor(state.distance));
  });

  it("stuurt niet van de weg af", () => {
    const state = emptyRoad();
    steer(state, -1);
    steer(state, -1);
    expect(state.lane).toBe(0);
    steer(state, 1);
    steer(state, 1);
    steer(state, 1);
    expect(state.lane).toBe(LANES - 1);
    run(state, 0.5);
    expect(state.x).toBe(LANES - 1);
  });
});

describe("botsen en oppakken", () => {
  it("een koe in je baan is game over", () => {
    const state = emptyRoad();
    state.entities.push({ id: 99, kind: "cow", at: 10, lane: 1 });
    run(state, 2);
    expect(state.status).toBe("over");
    expect(state.crash).toBe("cow");
  });

  it("uitwijken voor de koe werkt", () => {
    const state = emptyRoad();
    state.entities.push({ id: 99, kind: "cow", at: 10, lane: 1 });
    steer(state, 1);
    run(state, 2);
    expect(state.status).toBe("playing");
  });

  it("kokosnoten geven punten, bananen gaan in je tas", () => {
    const state = emptyRoad();
    state.entities.push({ id: 1, kind: "coconut", at: 5, lane: 1 }, { id: 2, kind: "banana", at: 8, lane: 1 });
    run(state, 1.5);
    expect(state.bonus).toBe(10);
    expect(state.bananas).toBe(1);
    expect(state.entities).toHaveLength(0);
  });
});

describe("de olifant", () => {
  it("laat je zonder banaan niet door, ook niet in een andere baan", () => {
    const state = emptyRoad();
    state.entities.push({ id: 1, kind: "elephant", at: 20, lane: 1 });
    steer(state, -1);
    run(state, 5);
    expect(state.crash).toBe("elephant");
  });

  it("met een banaan mag je erlangs", () => {
    const state = emptyRoad();
    state.bananas = 1;
    state.entities.push({ id: 1, kind: "elephant", at: 20, lane: 1 });
    expect(feed(state)).toBe(true);
    expect(state.bananas).toBe(0);
    run(state, 5);
    expect(state.status).toBe("playing");
    expect(drainEvents(state).some((e) => e.type === "fed")).toBe(true);
  });

  it("voeren zonder banaan mislukt en wordt gemeld", () => {
    const state = emptyRoad();
    state.entities.push({ id: 1, kind: "elephant", at: 20, lane: 1 });
    expect(feed(state)).toBe(false);
    expect(drainEvents(state)).toContainEqual({ type: "no-banana" });
  });

  it("verspilt geen banaan als er geen olifant in beeld is", () => {
    const state = emptyRoad();
    state.bananas = 2;
    state.entities.push({ id: 1, kind: "elephant", at: 200, lane: 1 });
    expect(feed(state)).toBe(false);
    expect(state.bananas).toBe(2);
  });

  it("remt af zodra hij in beeld komt", () => {
    const state = emptyRoad();
    run(state, 1);
    const cruising = state.speed;
    state.entities.push({ id: 1, kind: "elephant", at: state.distance + 25, lane: 1 });
    run(state, 0.6);
    expect(state.speed).toBeLessThan(cruising * 0.8);
  });
});

describe("de wegenbouwer", () => {
  it("legt voor elke olifant eerst een banaan neer", () => {
    for (const seed of [1, 2, 3, 42, 1234]) {
      const state = createGame(route, seed);
      const seen = new Map<number, string>();
      // Rij onkwetsbaar door: alleen kijken wat er op de weg verschijnt.
      while (state.distance < SEGMENT * 8) {
        step(state, DT);
        state.status = "playing";
        for (const e of state.entities) if (!seen.has(e.id)) seen.set(e.id, `${e.kind}@${e.at}`);
      }
      const order = [...seen.values()].map((v) => {
        const [kind, at] = v.split("@");
        return { kind, at: Number(at) };
      });
      const elephants = order.filter((o) => o.kind === "elephant");
      expect(elephants.length).toBeGreaterThan(2);
      for (const elephant of elephants) {
        const bananaBefore = order.some((o) => o.kind === "banana" && o.at < elephant.at && o.at > elephant.at - 120);
        expect(bananaBefore, `banaan voor olifant op ${elephant.at} (seed ${seed})`).toBe(true);
      }
    }
  });

  it("laat in elke rij een baan vrij", () => {
    for (const seed of [7, 8, 9]) {
      const state = createGame(route, seed);
      while (state.distance < SEGMENT * 6) {
        step(state, DT);
        state.status = "playing";
        const rows = new Map<number, Set<number>>();
        for (const e of state.entities) {
          if (!isObstacle(e.kind) || e.kind === "elephant" || e.kind === "bus" || e.kind === "dog") continue;
          const key = Math.round(e.at * 10);
          const lanes = rows.get(key) ?? new Set<number>();
          lanes.add(Math.round(e.lane));
          rows.set(key, lanes);
        }
        for (const lanes of rows.values()) expect(lanes.size).toBeLessThan(LANES);
      }
    }
  });
});
