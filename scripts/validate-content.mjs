// Controleert content/trip.json en content/decor.json voordat er iets gebouwd
// wordt. Draait mee in `pnpm build`, dus een fout in de content houdt de deploy
// tegen in plaats van een lege pagina op te leveren.
//
// Het JSON Schema in content/schema/ doet het werk in je editor (autocomplete,
// rode kringels). Dit script doet wat een schema niet kan: verwijzingen tussen
// bestanden, dubbele ids, of de vraag of het aantal nachten wel in de vlucht
// past.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const problems = [];
const warnings = [];

function fail(message) {
  problems.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(relativePath) {
  const full = path.join(root, relativePath);
  if (!existsSync(full)) {
    fail(`${relativePath} bestaat niet.`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(full, "utf8"));
  } catch (error) {
    fail(`${relativePath} is geen geldige JSON: ${error.message}`);
    return null;
  }
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateOnly(value) {
  return String(value).split("T")[0];
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/**
 * Elk foto-pad moet een bronbestand in photos/ hebben én een set uitgeleverde
 * varianten in public/photos/. Een typefout is anders een stille gebroken
 * afbeelding, en een bronfoto zonder varianten laadt helemaal niets.
 */
function checkPhotos(photos, where) {
  if (photos == null) return;
  if (!Array.isArray(photos)) return fail(`${where}: photos moet een lijst zijn.`);
  for (const photo of photos) {
    if (typeof photo !== "string" || photo.length === 0) {
      fail(`${where}: lege foto-verwijzing.`);
      continue;
    }
    if (photo.startsWith("http://") || photo.startsWith("https://")) continue;
    if (!photo.startsWith("/")) {
      fail(`${where}: foto "${photo}" moet met / beginnen (pad vanaf photos/) of een volledige URL zijn.`);
      continue;
    }
    if (!existsSync(path.join(root, "photos", photo.slice(1)))) {
      fail(`${where}: foto "${photo}" staat niet in photos/.`);
      continue;
    }
    usedPhotos.add(photo);
  }
}

/** Alle foto-paden die trip.json daadwerkelijk gebruikt, voor de manifest-controle onderaan. */
const usedPhotos = new Set();

/**
 * Controleert of src/data/photoManifest.ts nog bij de bronfoto's past. De
 * varianten worden gecommit in plaats van bij elke deploy opnieuw gegenereerd,
 * dus een aangepaste of nieuwe foto zonder `pnpm photos` zou anders stilletjes
 * de oude versie blijven tonen.
 */
function checkPhotoManifest() {
  const manifestPath = path.join(root, "src", "data", "photoManifest.ts");
  if (!existsSync(manifestPath)) {
    return fail("src/data/photoManifest.ts ontbreekt. Draai `pnpm photos`.");
  }

  const source = readFileSync(manifestPath, "utf8");

  for (const photo of usedPhotos) {
    const entry = source.match(new RegExp(`"${photo.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}":\\s*\\{[^}]*?hash: "([0-9a-f]+)"`, "s"));
    if (!entry) {
      fail(`Foto "${photo}" staat niet in photoManifest.ts. Draai \`pnpm photos\`.`);
      continue;
    }

    const sourceHash = createHash("sha256")
      .update(readFileSync(path.join(root, "photos", photo.slice(1))))
      .digest("hex")
      .slice(0, 12);

    if (entry[1] !== sourceHash) {
      fail(`Foto "${photo}" is aangepast sinds de laatste \`pnpm photos\`. De uitgeleverde variant is verouderd.`);
      continue;
    }

    // De varianten waarnaar het manifest verwijst moeten er ook echt staan:
    // public/photos/ wordt gecommit, dus een half afgebroken run is mogelijk.
    const block = source.slice(source.indexOf(`"${photo}":`));
    for (const [, url] of block.slice(0, block.indexOf("},")).matchAll(/url: "([^"]+)"/g)) {
      if (!existsSync(path.join(root, "public", url.slice(1)))) {
        fail(`Variant "${url}" van foto "${photo}" staat niet in public/. Draai \`pnpm photos\`.`);
      }
    }
  }
}

function checkCoords(item, where) {
  if (typeof item.lat !== "number" || item.lat < -90 || item.lat > 90) fail(`${where}: lat ontbreekt of ligt buiten -90..90.`);
  if (typeof item.lon !== "number" || item.lon < -180 || item.lon > 180) fail(`${where}: lon ontbreekt of ligt buiten -180..180.`);
}

function checkFlight(flight, label) {
  if (!flight) return fail(`Vlucht "${label}" ontbreekt.`);
  for (const field of ["airline", "from", "to", "duration"]) {
    if (typeof flight[field] !== "string" || flight[field].length === 0) {
      fail(`Vlucht "${label}": ${field} ontbreekt.`);
    }
  }
  for (const field of ["departAt", "arriveAt"]) {
    if (!ISO_DATETIME.test(flight[field] ?? "")) {
      fail(`Vlucht "${label}": ${field} moet de vorm "2027-01-25T11:45" hebben, niet "${flight[field]}".`);
    }
  }
  if (ISO_DATETIME.test(flight.departAt ?? "") && ISO_DATETIME.test(flight.arriveAt ?? "")) {
    if (Date.parse(`${flight.arriveAt}:00`) <= Date.parse(`${flight.departAt}:00`)) {
      // Lokale tijden in twee tijdzones, dus dit kan legitiem klein zijn; alleen
      // een echte omkering (aankomst vóór vertrek in kloktijd) is verdacht.
      warn(`Vlucht "${label}": aankomst ligt niet na vertrek. Klopt dat met de tijdzones?`);
    }
  }
}

// --- trip.json -------------------------------------------------------------

const trip = readJson("content/trip.json");

if (trip) {
  if (typeof trip.title !== "string" || trip.title.length === 0) fail("trip.json: title ontbreekt.");

  checkFlight(trip.flights?.outbound, "heen");
  checkFlight(trip.flights?.return, "terug");

  const modes = trip.transportModes ?? {};
  if (Object.keys(modes).length === 0) fail("trip.json: transportModes is leeg.");
  for (const [key, mode] of Object.entries(modes)) {
    if (!SLUG.test(key)) fail(`Vervoerssoort "${key}": gebruik kleine letters en koppeltekens.`);
    for (const field of ["label", "icon", "color"]) {
      if (typeof mode?.[field] !== "string" || mode[field].length === 0) {
        fail(`Vervoerssoort "${key}": ${field} ontbreekt.`);
      }
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(mode?.color ?? "")) fail(`Vervoerssoort "${key}": color moet een hexkleur zijn zoals "#215761".`);
    if (mode?.style !== "solid" && mode?.style !== "dashed") fail(`Vervoerssoort "${key}": style moet "solid" of "dashed" zijn.`);
  }

  const regionIds = new Set();
  for (const region of trip.regions ?? []) {
    if (!SLUG.test(region?.id ?? "")) fail(`Regio "${region?.id}": id moet een slug zijn.`);
    if (regionIds.has(region.id)) fail(`Dubbele regio-id: "${region.id}".`);
    regionIds.add(region.id);
    if (typeof region?.name !== "string" || region.name.length === 0) fail(`Regio "${region?.id}": name ontbreekt.`);
  }

  const stops = trip.stops ?? [];
  if (!Array.isArray(stops) || stops.length === 0) fail("trip.json: stops is leeg.");

  const stopIds = new Set();
  const activityIds = new Set();
  const usedRegions = new Set();
  let plannedNights = 0;

  for (const [i, stop] of stops.entries()) {
    const where = `Stop ${i + 1} ("${stop?.id ?? "?"}")`;

    if (!SLUG.test(stop?.id ?? "")) fail(`${where}: id moet een slug zijn (kleine letters, cijfers, koppeltekens).`);
    if (stopIds.has(stop.id)) fail(`Dubbele stop-id: "${stop.id}". Ids moeten uniek zijn en nooit hergebruikt worden.`);
    stopIds.add(stop.id);

    if (typeof stop?.name !== "string" || stop.name.length === 0) fail(`${where}: name ontbreekt.`);

    if (!Number.isInteger(stop?.nights) || stop.nights < 0) fail(`${where}: nights moet een heel getal van 0 of hoger zijn.`);
    else plannedNights += stop.nights;

    checkCoords(stop ?? {}, where);

    const mode = stop?.transportTo?.mode;
    if (!mode) fail(`${where}: transportTo.mode ontbreekt.`);
    else if (!(mode in modes)) {
      fail(`${where}: onbekende vervoerssoort "${mode}". Beschikbaar: ${Object.keys(modes).join(", ")}.`);
    }
    if (!stop?.transportTo?.label) fail(`${where}: transportTo.label ontbreekt.`);
    if (!stop?.transportTo?.duration) fail(`${where}: transportTo.duration ontbreekt.`);

    if (stop?.region != null) {
      if (!regionIds.has(stop.region)) {
        fail(`${where}: onbekende regio "${stop.region}". Beschikbaar: ${[...regionIds].join(", ") || "(geen)"}.`);
      }
      usedRegions.add(stop.region);
    }

    if ("dates" in (stop ?? {})) {
      fail(`${where}: "dates" wordt afgeleid uit de vluchten en nights. Haal het veld weg.`);
    }

    checkPhotos(stop?.photos, where);
    checkPhotos(stop?.accommodation?.photos, `${where} accommodatie`);
    if (stop?.accommodation && !stop.accommodation.name) fail(`${where}: accommodation.name ontbreekt.`);

    for (const activity of stop?.activities ?? []) {
      const aWhere = `${where}, activiteit "${activity?.id ?? "?"}"`;
      if (!SLUG.test(activity?.id ?? "")) fail(`${aWhere}: id moet een slug zijn.`);
      if (activityIds.has(activity.id)) fail(`Dubbele activiteit-id: "${activity.id}".`);
      activityIds.add(activity.id);
      if (!activity?.name) fail(`${aWhere}: name ontbreekt.`);
      if (!activity?.dist) fail(`${aWhere}: dist ontbreekt.`);
      if (activity?.priority != null && !["must", "nice", "maybe"].includes(activity.priority)) {
        fail(`${aWhere}: priority moet must, nice of maybe zijn.`);
      }
      if (activity?.daytrip) checkCoords(activity, `${aWhere} (dagtrip)`);
      checkPhotos(activity?.photos, aWhere);
    }
  }

  for (const id of regionIds) {
    if (!usedRegions.has(id)) warn(`Regio "${id}" wordt door geen enkele stop gebruikt; hij verschijnt dan nergens.`);
  }

  // De hoofdcontrole: passen de geplande nachten in het gat tussen landen en
  // terugvliegen? Dit is precies het sommetje dat je vroeger met de hand deed.
  const outbound = trip.flights?.outbound;
  const back = trip.flights?.return;
  if (ISO_DATETIME.test(outbound?.arriveAt ?? "") && ISO_DATETIME.test(back?.departAt ?? "")) {
    const available = daysBetween(dateOnly(outbound.arriveAt), dateOnly(back.departAt));
    if (available < 0) {
      fail(`De terugvlucht (${dateOnly(back.departAt)}) vertrekt vóór de aankomst (${dateOnly(outbound.arriveAt)}).`);
    } else if (plannedNights !== available) {
      const diff = plannedNights - available;
      fail(
        `De stops plannen ${plannedNights} nachten, maar tussen aankomst (${dateOnly(outbound.arriveAt)}) en ` +
          `terugvlucht (${dateOnly(back.departAt)}) zit ruimte voor ${available}. ` +
          `Dat is ${diff > 0 ? `${diff} te veel` : `${-diff} te weinig`}.`,
      );
    }
  }
}

// --- decor.json ------------------------------------------------------------

const decorSchema = readJson("content/schema/decor.schema.json");
const decor = readJson("content/decor.json");

const schemaTypes = decorSchema?.definitions?.item?.properties?.type?.enum ?? [];

// Tweede bron van waarheid voor dezelfde lijst: de registry in de app. Loopt hij
// uiteen met het schema, dan werkt de autocomplete in je editor niet meer op een
// type dat de app wél kent (of andersom).
const decorSource = existsSync(path.join(root, "src/data/mapDecor.ts"))
  ? readFileSync(path.join(root, "src/data/mapDecor.ts"), "utf8")
  : "";
const codeTypes = (decorSource.match(/export const DECOR_TYPES = \[([\s\S]*?)\] as const;/)?.[1] ?? "")
  .split(",")
  .map((entry) => entry.trim().replace(/^"|"$/g, ""))
  .filter(Boolean);

if (codeTypes.length > 0 && schemaTypes.length > 0) {
  const missingInSchema = codeTypes.filter((type) => !schemaTypes.includes(type));
  const missingInCode = schemaTypes.filter((type) => !codeTypes.includes(type));
  if (missingInSchema.length) warn(`decor.schema.json mist type(s): ${missingInSchema.join(", ")}.`);
  if (missingInCode.length) fail(`decor.schema.json kent type(s) die de app niet rendert: ${missingInCode.join(", ")}.`);
}

if (decor) {
  const known = new Set(codeTypes.length ? codeTypes : schemaTypes);

  const clearance = decor.clearance ?? {};
  for (const key of ["palmTree", "stupa", "temple", "sigiriyaRock", "monkeyTree", "critter", "peacock", "landmark", "waterfall"]) {
    if (typeof clearance[key] !== "number" || clearance[key] <= 0) fail(`decor.json: clearance.${key} ontbreekt of is niet positief.`);
  }

  for (const [i, item] of (decor.items ?? []).entries()) {
    const where = `Decor ${i + 1} ("${item?.type ?? "?"}")`;
    if (!known.has(item?.type)) {
      fail(`${where}: onbekend type. Beschikbaar: ${[...known].join(", ")}.`);
      continue;
    }
    if (item.type === "monkeyGrove") {
      if (!Array.isArray(item.trees) || item.trees.length < 2) fail(`${where}: heeft minstens twee bomen nodig.`);
      else {
        for (const tree of item.trees) {
          if (typeof tree?.x !== "number" || typeof tree?.z !== "number") fail(`${where}: elke boom heeft x en z nodig.`);
        }
      }
    } else if (typeof item.x !== "number" || typeof item.z !== "number") {
      fail(`${where}: x en z ontbreken.`);
    }
    if (item.rotation != null && typeof item.rotation !== "number") fail(`${where}: rotation moet een getal in radialen zijn.`);
  }
}

checkPhotoManifest();

// --- uitkomst --------------------------------------------------------------

for (const message of warnings) console.warn(`  ! ${message}`);

if (problems.length > 0) {
  console.error(`\nContent afgekeurd (${problems.length} ${problems.length === 1 ? "fout" : "fouten"}):\n`);
  for (const message of problems) console.error(`  ✗ ${message}`);
  console.error("\nZie content/README.md.\n");
  process.exit(1);
}

const stopCount = trip?.stops?.length ?? 0;
const decorCount = decor?.items?.length ?? 0;
console.log(`Content in orde: ${stopCount} stops, ${decorCount} decorobjecten${warnings.length ? `, ${warnings.length} waarschuwing(en)` : ""}.`);
