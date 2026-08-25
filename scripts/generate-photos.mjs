// Maakt van elke bronfoto in photos/ een set webp-varianten in public/photos/,
// plus src/data/photoManifest.ts met de afmetingen en de srcset per foto.
//
// Waarom: de bronfoto's zijn 1600px breed, terwijl ze in de app als thumbnail
// van 48-144px of als hero-strip van ~1280px getoond worden. Zonder varianten
// laadt een telefoon voor een duimnagel van 128px een bestand van 464 KB, en
// gaat datzelfde bestand ook nog integraal in de offline-precache.
//
// De bronbestanden staan bewust in photos/ en niet in public/: ze worden nooit
// uitgeleverd en horen dus niet in de service-worker-precache. Wat wél
// uitgeleverd wordt is de gegenereerde inhoud van public/photos/.
//
// Draaien met `pnpm photos`. De uitvoer wordt gecommit, zodat een deploy geen
// sharp hoeft te draaien; `pnpm validate` controleert of de varianten nog bij de
// bronbestanden passen en houdt de build tegen als je dit vergeet.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "photos");
const outputDir = path.join(root, "public", "photos");
const manifestFile = path.join(root, "src", "data", "photoManifest.ts");

/**
 * De breedtes waarop de app foto's daadwerkelijk toont, met device-pixel-ratio
 * meegerekend: 320 dekt elke thumbnail (48-144px bij DPR 2-3), 640 de galerij
 * op een retina-tablet, en 1280 zowel de hero-strip als de lightbox (een
 * telefoonscherm van 430pt bij DPR 3 is 1290px breed). Breedtes boven de bron
 * worden overgeslagen: opschalen levert alleen bytes op, geen detail.
 *
 * Bewust geen 1600: die maat kostte ~1,2 MB extra precache voor detail dat op
 * geen enkel toestel te onderscheiden is van de 1280.
 */
const WIDTHS = [320, 640, 1280];

/**
 * De kleine varianten staan als duimnagel naast tekst en mogen geen zichtbare
 * artefacten geven; de grote wordt schermvullend als foto bekeken, waar 72 net
 * zo goed leest en flink minder precache kost.
 */
function webpQuality(width) {
  return width <= 640 ? 80 : 72;
}

const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/** Hash van het bronbestand, zodat validate-content.mjs kan zien of de varianten verouderd zijn. */
function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
}

function sourceFiles() {
  return readdirSync(sourceDir)
    .filter((name) => PHOTO_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort();
}

async function generate() {
  // Volledig opnieuw opbouwen: een bronfoto die je verwijdert of hernoemt laat
  // anders wezen achter die wel in de precache belanden maar nergens meer bij horen.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const entries = [];

  for (const name of sourceFiles()) {
    const sourcePath = path.join(sourceDir, name);
    const slug = path.basename(name, path.extname(name));
    const image = sharp(sourcePath);
    const { width, height } = await image.metadata();

    if (!width || !height) {
      throw new Error(`Kan de afmetingen van photos/${name} niet lezen.`);
    }

    // De grootste variant is de bron, of de cap uit WIDTHS als de bron daarboven
    // ligt. Een bron die smaller is dan de kleinste maat (kandy.jpeg is 554px)
    // levert zo alsnog zijn eigen breedte op in plaats van niets.
    const maxWidth = Math.min(width, WIDTHS[WIDTHS.length - 1]);
    const widths = WIDTHS.filter((w) => w < maxWidth);
    widths.push(maxWidth);

    const variants = [];
    for (const targetWidth of widths) {
      const file = `${slug}-${targetWidth}.webp`;
      await image
        .clone()
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp({ quality: webpQuality(targetWidth), effort: 6 })
        .toFile(path.join(outputDir, file));
      variants.push({ width: targetWidth, url: `/photos/${file}` });
    }

    entries.push({
      key: `/${name}`,
      width,
      height,
      hash: hashFile(sourcePath),
      variants,
    });

    console.log(`photos/${name} (${width}x${height}) → ${variants.map((v) => v.width).join(", ")}`);
  }

  writeManifest(entries);
}

function writeManifest(entries) {
  const body = entries
    .map((entry) => {
      const variants = entry.variants
        .map((variant) => `      { width: ${variant.width}, url: "${variant.url}" },`)
        .join("\n");
      return [
        `  "${entry.key}": {`,
        `    width: ${entry.width},`,
        `    height: ${entry.height},`,
        `    hash: "${entry.hash}",`,
        `    variants: [`,
        variants,
        `    ],`,
        `  },`,
      ].join("\n");
    })
    .join("\n");

  const contents = `/**
 * GEGENEREERD BESTAND. Niet met de hand aanpassen.
 *
 * Gemaakt door \`pnpm photos\` (scripts/generate-photos.mjs) uit de bronfoto's in
 * photos/. De sleutel is het pad zoals content/trip.json het noemt ("/ella.webp");
 * de varianten zijn de daadwerkelijk uitgeleverde bestanden in public/photos/.
 *
 * \`hash\` is een vingerafdruk van het bronbestand. \`pnpm validate\` vergelijkt
 * hem, zodat een aangepaste foto zonder regenereren de build tegenhoudt in plaats
 * van stilletjes de oude versie te blijven tonen.
 */

export interface PhotoVariant {
  width: number;
  url: string;
}

export interface PhotoEntry {
  /** Intrinsieke breedte van de bronfoto, voor de aspect-ratio en het voorkomen van layout shift. */
  width: number;
  /** Intrinsieke hoogte van de bronfoto. */
  height: number;
  /** sha256-prefix van het bronbestand in photos/. */
  hash: string;
  /** Oplopend gesorteerd op breedte; de laatste is de grootste. */
  variants: PhotoVariant[];
}

export const photoManifest: Record<string, PhotoEntry> = {
${body}
};
`;

  writeFileSync(manifestFile, contents);
  console.log(`\n${entries.length} foto's → src/data/photoManifest.ts`);
}

await generate();
