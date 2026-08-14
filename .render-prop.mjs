// Offscreen sanity render of a map3d prop: pulls the real geometry-building
// code out of the component source (so it cannot drift from what ships),
// rasterises it with a z-buffer and writes a PPM.
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import ts from "typescript";

const [, , srcPath, cutMarker, outPath, returnExpr = "GEOMETRY", zoom = "1", targetY = "0.17"] = process.argv;

function mergeParts(parts) {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  return mergeGeometries(flat);
}

const source = readFileSync(srcPath, "utf8");
const end = source.indexOf(cutMarker);
if (end < 0) throw new Error(`marker not found: ${cutMarker}`);
let body = source
  .slice(0, end + cutMarker.length)
  .split("\n")
  .filter((line) => !line.startsWith("import "))
  .join("\n")
  .replace(/^export /gm, "");

const js = ts.transpileModule(body + `\nreturn ${returnExpr};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const geo = await new AsyncFunction("THREE", "mergeParts", js)(THREE, mergeParts);

// Colours roughly matching each part, just so the pieces are tellable apart.
const PALETTE = {
  body: [168, 73, 46],
  ledges: [140, 59, 37],
  summit: [201, 99, 63],
  scree: [125, 90, 69],
  ruins: [232, 220, 184],
  stairs: [109, 98, 89],
  garden: [111, 143, 74],
  shell: [51, 88, 154],
  roof: [179, 185, 192],
  rib: [154, 161, 169],
  trim: [230, 179, 74],
  glass: [207, 232, 239],
  frame: [58, 62, 69],
  axle: [51, 54, 59],
  frontWheel: [51, 54, 59],
  lamp: [255, 230, 171],
  canopy: [227, 166, 126],
  chrome: [142, 148, 156],
  luggage: [125, 106, 85],
};

const W = 560;
const H = 560;
const BG = [196, 173, 129];

const camera = new THREE.PerspectiveCamera(28, W / H, 0.01, 20);
camera.position.set(0.62, 0.66, 0.86).multiplyScalar(Number(zoom));
camera.lookAt(0, Number(targetY), 0);
camera.updateMatrixWorld();

const frame = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  frame[i * 3] = BG[0];
  frame[i * 3 + 1] = BG[1];
  frame[i * 3 + 2] = BG[2];
}
const zbuf = new Float32Array(W * H).fill(Infinity);

const LIGHT = new THREE.Vector3(0.45, 1, 0.35).normalize();

function drawTriangle(p0, p1, p2, shade, color) {
  const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
  const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
  const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
  if (Math.abs(area) < 1e-9) return;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((p1.x - px) * (p2.y - py) - (p2.x - px) * (p1.y - py)) / area;
      const w1 = ((p2.x - px) * (p0.y - py) - (p0.x - px) * (p2.y - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const depth = w0 * p0.z + w1 * p1.z + w2 * p2.z;
      const idx = y * W + x;
      if (depth >= zbuf[idx]) continue;
      zbuf[idx] = depth;
      frame[idx * 3] = Math.min(255, color[0] * shade);
      frame[idx * 3 + 1] = Math.min(255, color[1] * shade);
      frame[idx * 3 + 2] = Math.min(255, color[2] * shade);
    }
  }
}

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const ab = new THREE.Vector3();
const ac = new THREE.Vector3();
const normal = new THREE.Vector3();

// Wheels get their position in JSX, not in the geometry, so mirror that here.
const placed = [];
for (const [name, geometry] of Object.entries(geo)) {
  if (!geometry || !geometry.attributes) continue;
  if (name === "axle" && geo.axleZ !== undefined) {
    // A three-wheeler has one driven axle plus a front wheel; everything else has two axles.
    const ends = geo.frontWheelZ !== undefined ? [1] : [-1, 1];
    for (const end of ends) placed.push([name, geometry, [0, geo.wheelRadius ?? 0.016, end * geo.axleZ]]);
    continue;
  }
  if (name === "frontWheel" && geo.frontWheelZ !== undefined) {
    placed.push([name, geometry, [0, geo.wheelRadius ?? 0.014, geo.frontWheelZ]]);
    continue;
  }
  placed.push([name, geometry, [0, 0, 0]]);
}

for (const [name, geometry, offset] of placed) {
  const color = PALETTE[name] ?? [200, 200, 200];
  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = src.attributes.position;
  const vcol = src.attributes.color;

  for (let i = 0; i < pos.count; i += 3) {
    const tint = vcol ? vcol.getX(i) : 1;
    a.fromBufferAttribute(pos, i).add(new THREE.Vector3(...offset));
    b.fromBufferAttribute(pos, i + 1).add(new THREE.Vector3(...offset));
    c.fromBufferAttribute(pos, i + 2).add(new THREE.Vector3(...offset));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac).normalize();
    const shade = (0.45 + 0.65 * Math.max(0, normal.dot(LIGHT))) * tint;

    const projected = [a, b, c].map((v) => {
      const p = v.clone().project(camera);
      return { x: (p.x * 0.5 + 0.5) * W, y: (1 - (p.y * 0.5 + 0.5)) * H, z: p.z };
    });
    drawTriangle(projected[0], projected[1], projected[2], shade, color);
  }
}

const header = Buffer.from(`P6\n${W} ${H}\n255\n`, "ascii");
const pixels = Buffer.alloc(W * H * 3);
for (let i = 0; i < frame.length; i++) pixels[i] = Math.round(frame[i]);
writeFileSync(outPath, Buffer.concat([header, pixels]));
console.log("wrote", outPath);
