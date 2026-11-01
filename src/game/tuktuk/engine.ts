/**
 * Tuktuk leren rijden: de spelregels, los van React en van het tekenen.
 *
 * De wereld is een weg van drie banen. Afstanden zijn in meters langs de weg,
 * banen in baanbreedtes (0, 1, 2). De tuktuk rijdt vooruit en alles wat op de
 * weg staat heeft een vaste positie `at`; alleen bussen (tegemoetkomend) en
 * honden (zwalkend) bewegen zelf.
 *
 * step() past de staat ter plekke aan in plaats van een kopie terug te geven:
 * hij draait 120 keer per seconde en hoeft niet in React-state te leven.
 */

export type Biome = "coast" | "cultural" | "hill" | "south";
export type ObstacleKind = "cow" | "pothole" | "dog" | "bus" | "elephant";
export type PickupKind = "coconut" | "tea" | "banana";
export type EntityKind = ObstacleKind | PickupKind;

export interface RouteStop {
  id: string;
  name: string;
  biome: Biome;
}

export interface Entity {
  id: number;
  kind: EntityKind;
  /** Midden van het object, in meters langs de weg. */
  at: number;
  /** Baan als kommagetal: een hond kan tussen twee banen in lopen. */
  lane: number;
  /** Hond: pendelt tussen homeLane en awayLane; targetLane is waar hij nu heen loopt. */
  targetLane?: number;
  homeLane?: number;
  awayLane?: number;
  /** Olifant: gevoerd op dit tijdstip, daarna loopt hij van de weg af. */
  fedAt?: number;
  announced?: boolean;
}

export type GameEvent =
  | { type: "pickup"; kind: PickupKind }
  | { type: "stop"; index: number; name: string; lap: number }
  | { type: "elephant" }
  | { type: "fed" }
  | { type: "no-banana" }
  | { type: "crash"; kind: ObstacleKind };

export interface GameState {
  route: RouteStop[];
  time: number;
  /** Positie van het midden van de tuktuk. */
  distance: number;
  /** Huidige snelheid in m/s, inclusief afremmen voor een olifant. */
  speed: number;
  /** 1 is volle snelheid; zakt als er een hongerige olifant aankomt. */
  slow: number;
  /** De baan waar je naartoe stuurt, en waar de tuktuk nu echt rijdt. */
  lane: number;
  x: number;
  bonus: number;
  bananas: number;
  entities: Entity[];
  nextId: number;
  spawnCursor: number;
  nextElephantAt: number;
  /** De olifant waarvoor de banaan al op de weg ligt. */
  bananaFor: number;
  stopIndex: number;
  rng: number;
  status: "playing" | "over";
  crash: ObstacleKind | null;
  events: GameEvent[];
}

export const LANES = 3;
/** Meters per stop: een rondje over het eiland duurt een paar minuten. */
export const SEGMENT = 350;
/** Zo ver kijk je vooruit; render.ts schaalt het beeld hierop. */
export const VIEW_AHEAD = 27;
export const MAX_BANANAS = 3;
export const TUKTUK_LENGTH = 2.4;
export const TUKTUK_HALF_WIDTH = 0.26;

const BASE_SPEED = 11;
const SPEED_PER_STOP = 1.3;
const MAX_SPEED = 30;
const BUS_SPEED = 7;
const DOG_SPEED = 0.8;
const LANE_SPEED = 9;
const SPAWN_HORIZON = 64;
/** Olifant-moment: zodra hij in beeld komt rem je af, zodat je tijd hebt om te voeren. */
const ELEPHANT_SLOW = 0.55;
const FIRST_ELEPHANT_AT = 230;
const BANANA_LEAD = 75;
/** Lege weg voor een olifant, zodat je niet tegelijk moet uitwijken en voeren. */
const ELEPHANT_CLEARANCE = 8;

export const SIZES: Record<EntityKind, { length: number; halfWidth: number }> = {
  cow: { length: 1.8, halfWidth: 0.34 },
  pothole: { length: 1.0, halfWidth: 0.26 },
  dog: { length: 1.1, halfWidth: 0.2 },
  bus: { length: 5, halfWidth: 0.38 },
  // Een olifant staat dwars over de hele weg: zonder banaan kom je er niet langs.
  elephant: { length: 3, halfWidth: LANES },
  coconut: { length: 0.9, halfWidth: 0.24 },
  tea: { length: 0.8, halfWidth: 0.24 },
  banana: { length: 0.9, halfWidth: 0.26 },
};

const POINTS: Record<Exclude<PickupKind, "banana">, number> = { coconut: 10, tea: 25 };
const FED_POINTS = 15;
/** Een banaan die niet meer in je tas past is ook wat waard. */
const SPARE_BANANA_POINTS = 5;

const OBSTACLES = new Set<EntityKind>(["cow", "pothole", "dog", "bus", "elephant"]);

export function isObstacle(kind: EntityKind): kind is ObstacleKind {
  return OBSTACLES.has(kind);
}

export function biomeForRegion(region: string | undefined): Biome {
  if (region === "cultural-triangle") return "cultural";
  if (region === "hill-country") return "hill";
  if (region === "south-coast") return "south";
  return "coast";
}

/**
 * De route uit trip.json. De reis begint en eindigt in Negombo; die laatste
 * valt weg, anders sta je bij een nieuw rondje twee keer achter elkaar daar.
 */
export function routeFromStops(stops: readonly { id: string; name: string; region?: string }[]): RouteStop[] {
  const route = stops.map((s) => ({ id: s.id, name: s.name, biome: biomeForRegion(s.region) }));
  if (route.length > 1 && route[route.length - 1].name === route[0].name) route.pop();
  return route;
}

export function stopAt(route: RouteStop[], distance: number): { stop: RouteStop; index: number; lap: number } {
  const index = Math.max(0, Math.floor(distance / SEGMENT));
  return { stop: route[index % route.length], index, lap: Math.floor(index / route.length) + 1 };
}

export function score(state: GameState): number {
  return Math.floor(state.distance) + state.bonus;
}

/** mulberry32: klein, snel en met een seed herhaalbaar, zodat tests vaste wegen krijgen. */
function random(state: GameState): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomInt(state: GameState, max: number): number {
  return Math.floor(random(state) * max);
}

function between(state: GameState, min: number, max: number): number {
  return min + random(state) * (max - min);
}

export function createGame(route: RouteStop[], seed = Date.now()): GameState {
  if (route.length === 0) throw new Error("Een route heeft minstens één stop nodig");
  return {
    route,
    time: 0,
    distance: 0,
    speed: BASE_SPEED,
    slow: 1,
    lane: 1,
    x: 1,
    bonus: 0,
    bananas: 0,
    entities: [],
    nextId: 1,
    // Een rustig stukje weg om te beginnen.
    spawnCursor: 30,
    nextElephantAt: FIRST_ELEPHANT_AT,
    bananaFor: -1,
    stopIndex: 0,
    rng: seed | 0,
    status: "playing",
    crash: null,
    events: [],
  };
}

export function steer(state: GameState, direction: -1 | 1): void {
  if (state.status !== "playing") return;
  state.lane = Math.min(LANES - 1, Math.max(0, state.lane + direction));
}

function hungryElephantAhead(state: GameState, range: number): Entity | undefined {
  return state.entities.find(
    (e) => e.kind === "elephant" && e.fedAt === undefined && e.at - state.distance > 0 && e.at - state.distance <= range,
  );
}

/** Geeft de dichtstbijzijnde olifant in beeld een banaan. False als er niets te voeren valt of je tas leeg is. */
export function feed(state: GameState): boolean {
  if (state.status !== "playing") return false;
  const elephant = hungryElephantAhead(state, VIEW_AHEAD + 2);
  if (!elephant) return false;
  if (state.bananas === 0) {
    state.events.push({ type: "no-banana" });
    return false;
  }
  state.bananas -= 1;
  elephant.fedAt = state.time;
  state.bonus += FED_POINTS;
  state.events.push({ type: "fed" });
  return true;
}

export function canFeed(state: GameState): boolean {
  return state.status === "playing" && hungryElephantAhead(state, VIEW_AHEAD + 2) !== undefined;
}

function add(state: GameState, kind: EntityKind, at: number, lane: number, extra: Partial<Entity> = {}): Entity {
  const entity: Entity = { id: state.nextId++, kind, at, lane, ...extra };
  state.entities.push(entity);
  return entity;
}

function activeBusLane(state: GameState): number | null {
  const bus = state.entities.find((e) => e.kind === "bus" && e.at > state.distance - 6);
  return bus ? bus.lane : null;
}

function otherLanes(...taken: (number | null)[]): number[] {
  return [0, 1, 2].filter((l) => !taken.includes(l));
}

function pick<T>(state: GameState, items: readonly T[]): T {
  return items[randomInt(state, items.length)];
}

function staticObstacle(state: GameState, biome: Biome): "cow" | "pothole" {
  // In het bergland zijn de wegen slecht, in de Culturele Driehoek lopen overal koeien.
  const cowChance = biome === "cultural" ? 0.7 : biome === "hill" ? 0.35 : 0.5;
  return random(state) < cowChance ? "cow" : "pothole";
}

/** Een rij objecten op `at`. Laat altijd een baan vrij en geeft terug hoeveel weg hij in beslag neemt. */
function spawnRow(state: GameState, at: number): number {
  const { stop } = stopAt(state.route, at);
  const busLane = activeBusLane(state);
  const roll = random(state);
  const difficulty = Math.min(1, at / (SEGMENT * 6));

  // Een tegemoetkomende bus: alleen in een baan die tot daar leeg is.
  const busChance = stop.biome === "coast" ? 0.06 : 0.11;
  if (busLane === null && at > 160 && roll < busChance) {
    const free = otherLanes().filter(
      (l) => !state.entities.some((e) => Math.round(e.lane) === l && e.at > state.distance - 3 && e.at <= at + 6),
    );
    if (free.length > 0) {
      add(state, "bus", at, pick(state, free));
      return 4;
    }
  }

  // Een hond pendelt tussen twee buurbanen; zolang er een bus rijdt blijft hij thuis.
  if (busLane === null && roll < 0.24) {
    const home = randomInt(state, LANES);
    const away = home === 1 ? pick(state, [0, 2]) : 1;
    add(state, "dog", at, home, { homeLane: home, awayLane: away, targetLane: away });
    return 3;
  }

  // Een lijntje kokosnoten, soms een theeblad of een losse banaan.
  if (roll < 0.36) {
    const lane = pick(state, otherLanes(busLane));
    const treat = random(state);
    if (treat < 0.12) add(state, "tea", at, lane);
    else if (state.bananas < MAX_BANANAS && treat < 0.22) add(state, "banana", at, lane);
    else for (let i = 0; i < 3; i++) add(state, "coconut", at + i * 2.4, lane);
    return 6;
  }

  // Twee banen dicht. Niet terwijl er een bus rijdt: dan zou de enige vrije baan die van de bus zijn.
  if (busLane === null && roll < 0.36 + 0.3 * difficulty + 0.12) {
    const open = randomInt(state, LANES);
    for (const lane of otherLanes(open)) add(state, staticObstacle(state, stop.biome), at, lane);
    return 2;
  }

  const lane = pick(state, otherLanes(busLane));
  add(state, staticObstacle(state, stop.biome), at, lane);
  // Soms een kokosnoot ernaast als lokkertje.
  const rest = otherLanes(busLane, lane);
  if (rest.length > 0 && random(state) < 0.35) add(state, "coconut", at, pick(state, rest));
  return 2;
}

function elephantInterval(state: GameState, at: number): number {
  const { stop } = stopAt(state.route, at);
  // Op weg naar Yala en langs de zuidkust staan ze vaker op de weg.
  return stop.biome === "south" ? between(state, 170, 280) : between(state, 300, 480);
}

function spawn(state: GameState): void {
  while (state.spawnCursor < state.distance + SPAWN_HORIZON) {
    const at = state.spawnCursor;
    const elephantAt = state.nextElephantAt;
    const bananaPlaced = state.bananaFor === elephantAt;
    // Hoe sneller je gaat, hoe meer ruimte tussen rijen: je moet het kunnen halen.
    const gap = Math.max(7, state.speed * 0.5) + between(state, 0, 7);

    if (!bananaPlaced && at >= elephantAt - BANANA_LEAD) {
      // Elke olifant krijgt vooraf een banaan op de weg, anders is hij niet te halen.
      add(state, "banana", at, pick(state, otherLanes(activeBusLane(state))));
      state.bananaFor = elephantAt;
      state.spawnCursor = at + gap;
    } else if (bananaPlaced && at >= elephantAt - ELEPHANT_CLEARANCE) {
      const position = at + ELEPHANT_CLEARANCE;
      add(state, "elephant", position, 1);
      state.nextElephantAt = position + elephantInterval(state, position);
      state.spawnCursor = position + 16;
    } else {
      const used = spawnRow(state, at);
      // Gewone rijen stoppen bij de volgende mijlpaal: de banaan of de lege weg voor de olifant.
      const milestone = bananaPlaced ? elephantAt - ELEPHANT_CLEARANCE : elephantAt - BANANA_LEAD;
      state.spawnCursor = Math.min(at + used + gap, Math.max(at + used, milestone));
    }
  }
}

function overlaps(state: GameState, e: Entity): boolean {
  const size = SIZES[e.kind];
  return (
    Math.abs(e.at - state.distance) < (TUKTUK_LENGTH + size.length) / 2 &&
    Math.abs(e.lane - state.x) < TUKTUK_HALF_WIDTH + size.halfWidth
  );
}

export function step(state: GameState, dt: number): void {
  if (state.status !== "playing") return;
  state.time += dt;

  const elephant = hungryElephantAhead(state, VIEW_AHEAD + 3);
  const targetSlow = elephant ? ELEPHANT_SLOW : 1;
  state.slow += (targetSlow - state.slow) * Math.min(1, dt * 4);
  state.speed = Math.min(MAX_SPEED, BASE_SPEED + (state.distance / SEGMENT) * SPEED_PER_STOP) * state.slow;
  state.distance += state.speed * dt;

  const laneDelta = state.lane - state.x;
  const move = LANE_SPEED * dt;
  state.x = Math.abs(laneDelta) <= move ? state.lane : state.x + Math.sign(laneDelta) * move;

  const { index, stop, lap } = stopAt(state.route, state.distance);
  if (index !== state.stopIndex) {
    state.stopIndex = index;
    state.events.push({ type: "stop", index, name: stop.name, lap });
  }

  spawn(state);

  for (const e of state.entities) {
    if (e.kind === "bus") e.at -= BUS_SPEED * dt;
    if (e.kind === "dog" && e.targetLane !== undefined) {
      const d = e.targetLane - e.lane;
      const m = DOG_SPEED * dt;
      if (Math.abs(d) <= m) {
        e.lane = e.targetLane;
        e.targetLane = e.targetLane === e.homeLane ? e.awayLane : e.homeLane;
      } else {
        e.lane += Math.sign(d) * m;
      }
    }
    if (e.kind === "elephant" && !e.announced && e.fedAt === undefined && e.at - state.distance <= VIEW_AHEAD) {
      e.announced = true;
      state.events.push({ type: "elephant" });
    }
  }

  const taken = new Set<Entity>();
  for (const e of state.entities) {
    if (!overlaps(state, e)) continue;
    if (isObstacle(e.kind)) {
      if (e.kind === "elephant" && e.fedAt !== undefined) continue;
      state.status = "over";
      state.crash = e.kind;
      state.events.push({ type: "crash", kind: e.kind });
      return;
    }
    taken.add(e);
    if (e.kind === "banana") {
      if (state.bananas < MAX_BANANAS) state.bananas += 1;
      else state.bonus += SPARE_BANANA_POINTS;
    } else {
      state.bonus += POINTS[e.kind];
    }
    state.events.push({ type: "pickup", kind: e.kind });
  }

  state.entities = state.entities.filter((e) => !taken.has(e) && e.at > state.distance - 12);
}

/** Haalt de gebeurtenissen sinds de vorige keer op en maakt de lijst leeg. */
export function drainEvents(state: GameState): GameEvent[] {
  const events = state.events;
  state.events = [];
  return events;
}
