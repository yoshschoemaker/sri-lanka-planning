import { SEGMENT, SIZES, stopAt, TUKTUK_HALF_WIDTH, TUKTUK_LENGTH, VIEW_AHEAD, type Biome, type Entity, type GameState } from "./engine";

/**
 * Tekent één frame op een 2D-canvas. Alles is met paden getekend in de kleuren
 * van de app, geen plaatjes of emoji: die zien er per toestel anders uit en
 * moeten offline ook nog geladen zijn.
 *
 * Bovenaanzicht: de weg loopt van onder naar boven, de tuktuk staat vast
 * onderin en de wereld schuift naar beneden.
 */

export interface View {
  width: number;
  height: number;
}

interface Layout {
  roadLeft: number;
  roadWidth: number;
  laneWidth: number;
  playerY: number;
  pxPerMeter: number;
}

const GROUND: Record<Biome, string> = {
  coast: "#ead9b0",
  cultural: "#c98d5f",
  hill: "#6f9a58",
  south: "#c4ae66",
};

const ROAD = "#4a4038";
const ROAD_LINE = "#faf5ea";
const INK = "#2c2319";
const CREAM = "#faf5ea";
const TERRACOTTA_DARK = "#9c5030";
const FOREST_DARK = "#1e3f34";
const TUKTUK_BODY = "#cf7411";

const DECOR_SLOT = 4.5;
const SERIF = '"Playfair Display Variable", "Playfair Display", Georgia, serif';

export function layout({ width, height }: View): Layout {
  const roadWidth = Math.min(width * 0.7, 380);
  const playerY = height * 0.76;
  return {
    roadWidth,
    roadLeft: (width - roadWidth) / 2,
    laneWidth: roadWidth / 3,
    playerY,
    pxPerMeter: playerY / VIEW_AHEAD,
  };
}

/** Vast getal per vak langs de weg, zodat een palm bij het terugkomen op dezelfde plek staat. */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ellipse(ctx, x + w * 0.06, y + h * 0.08, w / 2, h / 2, "rgba(30, 20, 10, 0.22)");
}

// --- Omgeving ---------------------------------------------------------------

function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, turn: number) {
  ellipse(ctx, x + size * 0.15, y + size * 0.2, size * 0.5, size * 0.35, "rgba(30, 20, 10, 0.15)");
  ctx.strokeStyle = "#3f7a3a";
  ctx.lineCap = "round";
  ctx.lineWidth = size * 0.22;
  for (let i = 0; i < 6; i++) {
    const a = turn + (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * size * 0.4, y + Math.sin(a) * size * 0.4 - size * 0.1, x + Math.cos(a) * size * 0.62, y + Math.sin(a) * size * 0.62);
    ctx.stroke();
  }
  ellipse(ctx, x, y, size * 0.13, size * 0.13, "#7a5a33");
}

function drawStupa(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ellipse(ctx, x + size * 0.12, y + size * 0.14, size * 0.5, size * 0.42, "rgba(30, 20, 10, 0.18)");
  ellipse(ctx, x, y, size * 0.5, size * 0.5, "#efe7d6");
  ellipse(ctx, x, y, size * 0.32, size * 0.32, "#f8f3e8");
  roundRect(ctx, x - size * 0.09, y - size * 0.09, size * 0.18, size * 0.18, 2, "#d9b25a");
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ellipse(ctx, x + size * 0.1, y + size * 0.12, size * 0.42, size * 0.36, "rgba(30, 20, 10, 0.15)");
  ellipse(ctx, x - size * 0.15, y, size * 0.28, size * 0.26, color);
  ellipse(ctx, x + size * 0.15, y + size * 0.05, size * 0.3, size * 0.27, color);
  ellipse(ctx, x, y - size * 0.15, size * 0.27, size * 0.25, color);
}

function drawAcacia(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ellipse(ctx, x + size * 0.18, y + size * 0.2, size * 0.6, size * 0.4, "rgba(30, 20, 10, 0.18)");
  ellipse(ctx, x, y, size * 0.6, size * 0.42, "#5f7d3a");
  ellipse(ctx, x - size * 0.12, y - size * 0.08, size * 0.35, size * 0.22, "#76964a");
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ellipse(ctx, x, y, size * 0.32, size * 0.24, "#8e8577");
  ellipse(ctx, x - size * 0.06, y - size * 0.05, size * 0.18, size * 0.12, "#a69d8e");
}

function drawSides(ctx: CanvasRenderingContext2D, state: GameState, view: View, l: Layout) {
  const top = state.distance + l.playerY / l.pxPerMeter;
  const bottom = state.distance - (view.height - l.playerY) / l.pxPerMeter;
  const y = (at: number) => l.playerY - (at - state.distance) * l.pxPerMeter;

  // Grond per stop, zodat je een nieuw gebied echt ziet binnenrollen.
  for (let i = Math.floor(bottom / SEGMENT); i <= Math.floor(top / SEGMENT); i++) {
    const { stop } = stopAt(state.route, Math.max(0, i) * SEGMENT);
    const y1 = Math.min(view.height, y(i * SEGMENT));
    const y2 = Math.max(0, y((i + 1) * SEGMENT));
    ctx.fillStyle = GROUND[stop.biome];
    ctx.fillRect(0, y2, view.width, y1 - y2);

    if (stop.biome === "hill") {
      // Rijen theestruiken over de heuvels.
      ctx.fillStyle = "#527f45";
      const from = Math.max(i * SEGMENT, Math.floor(bottom / 1.6) * 1.6);
      const to = Math.min((i + 1) * SEGMENT, top);
      for (let at = from; at < to; at += 1.6) {
        const ry = y(at);
        ctx.beginPath();
        ctx.roundRect(4, ry - 5, l.roadLeft - 14, 9, 5);
        ctx.roundRect(l.roadLeft + l.roadWidth + 10, ry - 5, view.width - l.roadLeft - l.roadWidth - 14, 9, 5);
        ctx.fill();
      }
    }
  }

  const margin = l.roadLeft;
  if (margin < 22) return;
  const size = Math.min(46, margin * 0.7, l.laneWidth * 0.55);
  for (let s = Math.floor(bottom / DECOR_SLOT) - 1; s <= Math.ceil(top / DECOR_SLOT) + 1; s++) {
    const h = hash(s);
    if (h > 0.62) continue;
    const at = s * DECOR_SLOT;
    const { stop } = stopAt(state.route, Math.max(0, at));
    const right = hash(s + 7919) > 0.5;
    const spread = 0.3 + hash(s + 104729) * 0.4;
    const x = right ? l.roadLeft + l.roadWidth + margin * spread : margin * (1 - spread);
    const dy = y(at);
    const variant = hash(s + 31337);
    if (stop.biome === "coast") {
      if (variant < 0.75) drawPalm(ctx, x, dy, size, h * 10);
      else drawBush(ctx, x, dy, size * 0.6, "#8aa356");
    } else if (stop.biome === "cultural") {
      if (variant < 0.25) drawStupa(ctx, x, dy, size * 0.9);
      else if (variant < 0.6) drawPalm(ctx, x, dy, size * 0.9, h * 10);
      else drawBush(ctx, x, dy, size * 0.7, "#6d8c45");
    } else if (stop.biome === "hill") {
      if (variant < 0.5) drawBush(ctx, x, dy, size * 0.8, FOREST_DARK);
    } else if (variant < 0.55) {
      drawAcacia(ctx, x, dy, size);
    } else if (variant < 0.8) {
      drawRock(ctx, x, dy, size);
    } else {
      drawBush(ctx, x, dy, size * 0.6, "#7f8f47");
    }
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, state: GameState, view: View, l: Layout) {
  ctx.fillStyle = "#3a322b";
  ctx.fillRect(l.roadLeft - 5, 0, l.roadWidth + 10, view.height);
  ctx.fillStyle = ROAD;
  ctx.fillRect(l.roadLeft, 0, l.roadWidth, view.height);

  ctx.fillStyle = "rgba(250, 245, 234, 0.55)";
  ctx.fillRect(l.roadLeft + 5, 0, 3, view.height);
  ctx.fillRect(l.roadLeft + l.roadWidth - 8, 0, 3, view.height);

  // Streepjes tussen de banen, die met de afstand meeschuiven.
  const dash = 2.2;
  const period = 5;
  const offset = (state.distance % period) * l.pxPerMeter;
  ctx.fillStyle = ROAD_LINE;
  for (let lane = 1; lane < 3; lane++) {
    const x = l.roadLeft + lane * l.laneWidth - 2;
    for (let yy = -period * l.pxPerMeter + offset; yy < view.height; yy += period * l.pxPerMeter) {
      ctx.fillRect(x, yy, 4, dash * l.pxPerMeter);
    }
  }
}

function drawStopGate(ctx: CanvasRenderingContext2D, state: GameState, view: View, l: Layout) {
  const top = state.distance + l.playerY / l.pxPerMeter;
  const bottom = state.distance - (view.height - l.playerY) / l.pxPerMeter;
  for (let i = Math.max(1, Math.ceil(bottom / SEGMENT)); i * SEGMENT <= top + 3; i++) {
    const y = l.playerY - (i * SEGMENT - state.distance) * l.pxPerMeter;
    const { stop } = stopAt(state.route, i * SEGMENT);
    const name = stop.name.toUpperCase();
    // Twee palen naast de weg en een bord eroverheen.
    roundRect(ctx, l.roadLeft - 12, y - 6, 10, 12, 3, TERRACOTTA_DARK);
    roundRect(ctx, l.roadLeft + l.roadWidth + 2, y - 6, 10, 12, 3, TERRACOTTA_DARK);
    const fontSize = Math.max(12, Math.min(20, l.roadWidth / 14));
    ctx.font = `700 ${fontSize}px ${SERIF}`;
    const w = Math.min(l.roadWidth + 10, ctx.measureText(name).width + 32);
    roundRect(ctx, view.width / 2 - w / 2 + 3, y - fontSize + 4, w, fontSize * 1.8, 8, "rgba(30, 20, 10, 0.25)");
    roundRect(ctx, view.width / 2 - w / 2, y - fontSize, w, fontSize * 1.8, 8, TERRACOTTA_DARK);
    roundRect(ctx, view.width / 2 - w / 2 + 3, y - fontSize + 3, w - 6, fontSize * 1.8 - 6, 6, CREAM);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, view.width / 2, y - fontSize + fontSize * 0.92);
  }
}

// --- Figuren ----------------------------------------------------------------

export function drawTuktuk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  shadow(ctx, 0, 0, w * 1.05, h);
  // Wielen: één voor, twee achter. Dat maakt een tuktuk een tuktuk.
  roundRect(ctx, -w * 0.09, -h * 0.52, w * 0.18, h * 0.2, 3, "#1c1712");
  roundRect(ctx, -w * 0.58, h * 0.12, w * 0.2, h * 0.26, 3, "#1c1712");
  roundRect(ctx, w * 0.38, h * 0.12, w * 0.2, h * 0.26, 3, "#1c1712");
  // Neus, smal naar voren.
  ctx.fillStyle = TUKTUK_BODY;
  ctx.beginPath();
  ctx.moveTo(-w * 0.2, -h * 0.5);
  ctx.quadraticCurveTo(0, -h * 0.58, w * 0.2, -h * 0.5);
  ctx.lineTo(w * 0.46, -h * 0.12);
  ctx.lineTo(w * 0.46, h * 0.45);
  ctx.quadraticCurveTo(0, h * 0.55, -w * 0.46, h * 0.45);
  ctx.lineTo(-w * 0.46, -h * 0.12);
  ctx.closePath();
  ctx.fill();
  // Dak, met een streep zoals de tuktuks in Kandy.
  roundRect(ctx, -w * 0.44, -h * 0.22, w * 0.88, h * 0.66, w * 0.22, FOREST_DARK);
  roundRect(ctx, -w * 0.44, -h * 0.02, w * 0.88, h * 0.07, 0, "#e3a67e");
  // Voorruit en koplamp.
  roundRect(ctx, -w * 0.3, -h * 0.3, w * 0.6, h * 0.08, 3, "#9fc7cf");
  ellipse(ctx, 0, -h * 0.47, w * 0.08, w * 0.08, "#fff6c9");
  ctx.restore();
}

function drawCow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, flip: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  shadow(ctx, 0, 0, w, h);
  // Staart
  ctx.strokeStyle = "#6b4a33";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w * 0.38, 0);
  ctx.quadraticCurveTo(-w * 0.5, h * 0.1, -w * 0.48, h * 0.32);
  ctx.stroke();
  ellipse(ctx, -w * 0.04, 0, w * 0.36, h * 0.34, "#f4efe4");
  ellipse(ctx, -w * 0.14, -h * 0.08, w * 0.12, h * 0.13, "#6b4a33");
  ellipse(ctx, w * 0.1, h * 0.1, w * 0.09, h * 0.1, "#6b4a33");
  // Kop met hoorns
  ellipse(ctx, w * 0.36, 0, w * 0.13, h * 0.2, "#e8dccb");
  ellipse(ctx, w * 0.45, 0, w * 0.06, h * 0.12, "#d9a89a");
  ctx.strokeStyle = "#cdbb94";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.33, -h * 0.16);
  ctx.lineTo(w * 0.38, -h * 0.36);
  ctx.moveTo(w * 0.33, h * 0.16);
  ctx.lineTo(w * 0.38, h * 0.36);
  ctx.stroke();
  ctx.restore();
}

function drawPothole(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ellipse(ctx, x, y, w * 0.5, h * 0.5, "#6b5d50");
  ellipse(ctx, x, y + h * 0.04, w * 0.42, h * 0.4, "#211b16");
  ellipse(ctx, x - w * 0.12, y - h * 0.1, w * 0.12, h * 0.08, "rgba(102, 191, 209, 0.35)");
}

function drawDog(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, flip: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  shadow(ctx, 0, 0, w, h * 0.8);
  ctx.strokeStyle = "#a8783f";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.35, 0);
  ctx.quadraticCurveTo(-w * 0.55, -h * 0.25, -w * 0.5, -h * 0.4);
  ctx.stroke();
  ellipse(ctx, -w * 0.05, 0, w * 0.32, h * 0.28, "#c79a5b");
  ellipse(ctx, w * 0.3, 0, w * 0.15, h * 0.22, "#d2a86a");
  ellipse(ctx, w * 0.27, -h * 0.2, w * 0.06, h * 0.1, "#7a5430");
  ellipse(ctx, w * 0.27, h * 0.2, w * 0.06, h * 0.1, "#7a5430");
  ellipse(ctx, w * 0.44, 0, w * 0.04, w * 0.04, INK);
  ctx.restore();
}

function drawBus(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  shadow(ctx, x, y, w * 1.04, h);
  roundRect(ctx, x - w / 2, y - h / 2, w, h, w * 0.18, "#b8322a");
  // Dak met imperiaal
  roundRect(ctx, x - w * 0.36, y - h * 0.4, w * 0.72, h * 0.66, w * 0.1, "#d6463b");
  ctx.fillStyle = "#7a1f1a";
  for (let i = 0; i < 5; i++) ctx.fillRect(x - w * 0.3, y - h * 0.34 + i * h * 0.12, w * 0.6, 2);
  roundRect(ctx, x - w / 2, y + h * 0.06, w, h * 0.05, 0, "#f5cf3a");
  // De bus komt je tegemoet: voorruit en koplampen aan jouw kant.
  roundRect(ctx, x - w * 0.4, y + h * 0.32, w * 0.8, h * 0.1, 4, "#2c3a40");
  ellipse(ctx, x - w * 0.34, y + h * 0.47, w * 0.08, w * 0.06, "#fff6c9");
  ellipse(ctx, x + w * 0.34, y + h * 0.47, w * 0.08, w * 0.06, "#fff6c9");
}

function drawElephant(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number) {
  const sway = Math.sin(time * 3) * w * 0.03;
  shadow(ctx, x, y, w, h * 0.9);
  // Rug en romp, met de kop naar jou toe.
  ellipse(ctx, x, y - h * 0.12, w * 0.4, h * 0.36, "#8d8781");
  ellipse(ctx, x - w * 0.08, y - h * 0.22, w * 0.18, h * 0.12, "#9c968f");
  // Oren
  ellipse(ctx, x - w * 0.27, y + h * 0.12, w * 0.2, h * 0.3, "#7c766f");
  ellipse(ctx, x + w * 0.27, y + h * 0.12, w * 0.2, h * 0.3, "#7c766f");
  ellipse(ctx, x - w * 0.27, y + h * 0.12, w * 0.13, h * 0.2, "#b08e86");
  ellipse(ctx, x + w * 0.27, y + h * 0.12, w * 0.13, h * 0.2, "#b08e86");
  ellipse(ctx, x, y + h * 0.15, w * 0.18, h * 0.28, "#8d8781");
  // Slagtanden en slurf
  ctx.strokeStyle = "#f6efe0";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - w * 0.08, y + h * 0.3);
  ctx.lineTo(x - w * 0.12, y + h * 0.44);
  ctx.moveTo(x + w * 0.08, y + h * 0.3);
  ctx.lineTo(x + w * 0.12, y + h * 0.44);
  ctx.stroke();
  ctx.strokeStyle = "#857f78";
  ctx.lineWidth = w * 0.07;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.3);
  ctx.quadraticCurveTo(x + sway, y + h * 0.5, x + w * 0.06 + sway, y + h * 0.58);
  ctx.stroke();
  ellipse(ctx, x - w * 0.09, y + h * 0.08, w * 0.025, w * 0.025, INK);
  ellipse(ctx, x + w * 0.09, y + h * 0.08, w * 0.025, w * 0.025, INK);
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = "#e0545b";
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.35);
  ctx.bezierCurveTo(x - size * 0.6, y - size * 0.1, x - size * 0.3, y - size * 0.6, x, y - size * 0.25);
  ctx.bezierCurveTo(x + size * 0.3, y - size * 0.6, x + size * 0.6, y - size * 0.1, x, y + size * 0.35);
  ctx.fill();
  ctx.restore();
}

export function drawBanana(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.4);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c99a1c";
  ctx.lineWidth = size * 0.36;
  ctx.beginPath();
  ctx.arc(0, -size * 0.35, size * 0.55, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  ctx.strokeStyle = "#f5cf3a";
  ctx.lineWidth = size * 0.26;
  ctx.beginPath();
  ctx.arc(0, -size * 0.38, size * 0.55, Math.PI * 0.22, Math.PI * 0.78);
  ctx.stroke();
  ellipse(ctx, size * 0.32, size * 0.03, size * 0.07, size * 0.07, "#5c4320");
  ctx.restore();
}

function drawCoconut(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ellipse(ctx, x + size * 0.08, y + size * 0.1, size * 0.42, size * 0.36, "rgba(30, 20, 10, 0.2)");
  ellipse(ctx, x, y, size * 0.42, size * 0.42, "#e8892b");
  ellipse(ctx, x - size * 0.12, y - size * 0.12, size * 0.16, size * 0.12, "#f6b25a");
  ellipse(ctx, x, y - size * 0.34, size * 0.14, size * 0.1, "#5e8b3a");
}

function drawTea(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.5);
  ctx.fillStyle = "#3f8a3a";
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.quadraticCurveTo(size * 0.45, 0, 0, size * 0.5);
  ctx.quadraticCurveTo(-size * 0.45, 0, 0, -size * 0.5);
  ctx.fill();
  ctx.strokeStyle = "#a9d37f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.4);
  ctx.lineTo(0, size * 0.4);
  ctx.stroke();
  ctx.restore();
}

function drawWarning(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "#f5cf3a";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.5);
  ctx.lineTo(x + size * 0.55, y + size * 0.45);
  ctx.lineTo(x - size * 0.55, y + size * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `800 ${size * 0.6}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", x, y + size * 0.12);
}

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, state: GameState, l: Layout) {
  const size = SIZES[e.kind];
  const x = l.roadLeft + l.laneWidth * (e.lane + 0.5);
  const y = l.playerY - (e.at - state.distance) * l.pxPerMeter;
  const h = size.length * l.pxPerMeter;
  const w = size.halfWidth * 2 * l.laneWidth;
  const pickup = Math.min(l.laneWidth * 0.45, h * 1.9);
  const bob = Math.sin(state.time * 5 + e.id) * 2;

  switch (e.kind) {
    case "cow":
      drawCow(ctx, x, y, w, h, e.id % 2 === 0);
      break;
    case "pothole":
      drawPothole(ctx, x, y, w, h);
      break;
    case "dog":
      drawDog(ctx, x, y, l.laneWidth * 0.5, h, (e.targetLane ?? e.lane) < e.lane);
      break;
    case "bus":
      drawBus(ctx, x, y, w, h);
      break;
    case "elephant": {
      const ew = Math.min(l.roadWidth * 0.62, l.laneWidth * 1.9);
      const eh = Math.max(h * 1.35, ew * 0.62);
      if (e.fedAt === undefined) {
        drawElephant(ctx, x, y, ew, eh, state.time);
      } else {
        // Gevoerd: hij sjokt tevreden de berm in.
        const since = state.time - e.fedAt;
        const off = Math.min(l.roadWidth * 0.75, since * l.laneWidth * 1.8);
        drawElephant(ctx, x + off, y, ew, eh, state.time);
        drawHeart(ctx, x + off, y - eh * 0.6 - since * 30, 22, 1 - since / 1.4);
      }
      break;
    }
    case "coconut":
      drawCoconut(ctx, x, y + bob, pickup);
      break;
    case "tea":
      drawTea(ctx, x, y + bob, pickup);
      break;
    case "banana":
      ellipse(ctx, x, y + bob, pickup * 0.65, pickup * 0.65, "rgba(250, 245, 234, 0.35)");
      drawBanana(ctx, x, y + bob, pickup);
      break;
  }
}

function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "#f5cf3a";
  ctx.strokeStyle = TERRACOTTA_DARK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? size : size * 0.5;
    const a = (i / 16) * Math.PI * 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, view: View) {
  const l = layout(view);
  drawSides(ctx, state, view, l);
  drawRoad(ctx, state, view, l);
  drawStopGate(ctx, state, view, l);

  // Ver weg eerst, zodat dichterbij eroverheen valt.
  const visible = state.entities
    .filter((e) => e.at - state.distance < VIEW_AHEAD + 4)
    .sort((a, b) => b.at - a.at);
  for (const e of visible) drawEntity(ctx, e, state, l);

  // Een bus die nog buiten beeld is kondigt zich aan.
  const blink = Math.floor(state.time * 5) % 2 === 0;
  for (const e of state.entities) {
    if (e.kind === "bus" && e.at - state.distance > VIEW_AHEAD + 1 && blink) {
      drawWarning(ctx, l.roadLeft + l.laneWidth * (e.lane + 0.5), 30, Math.min(34, l.laneWidth * 0.4));
    }
  }

  const px = l.roadLeft + l.laneWidth * (state.x + 0.5);
  const tilt = (state.lane - state.x) * 0.25;
  drawTuktuk(ctx, px, l.playerY, TUKTUK_HALF_WIDTH * 2 * l.laneWidth * 1.15, TUKTUK_LENGTH * l.pxPerMeter, tilt);

  if (stopAt(state.route, state.distance).stop.biome === "hill") {
    // Mist in het bergland: je ziet minder ver vooruit.
    const mist = ctx.createLinearGradient(0, 0, 0, view.height * 0.42);
    mist.addColorStop(0, "rgba(250, 245, 234, 0.82)");
    mist.addColorStop(1, "rgba(250, 245, 234, 0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, view.width, view.height * 0.42);
  }

  if (state.status === "over") drawBurst(ctx, px, l.playerY - TUKTUK_LENGTH * l.pxPerMeter * 0.45, l.laneWidth * 0.32);
}
