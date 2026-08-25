// Doorloopt de app met axe en meldt elke WCAG-overtreding.
//
// Waarom dit een script is en geen eenmalige controle: de toegankelijkheid van
// deze app hangt aan dingen die je met het oog niet ziet. Een dialoog zonder
// role, een <ol> met een div erin, een tweede <h1> op de pagina. Dat sloop je er
// per ongeluk in, en dan valt het pas op als iemand met een schermlezer erop
// stuit. Draai dit dus mee in CI.
//
// Draait tegen de echte build via `vite preview`, niet tegen de dev-server: de
// uitkomst hoort te gaan over wat er daadwerkelijk uitgeleverd wordt.
//
// Gebruik: `pnpm build && pnpm audit:a11y`.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4319;
const BASE_URL = `http://localhost:${PORT}`;

/** Splash en dagelijkse confetti zijn tijdgebonden overlays die de audit alleen in de weg zitten. */
const SKIP_DAILY_FLOURISH = (key) => {
  window.localStorage.setItem("srilanka-trip:daily-countdown-shown", key);
};

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

/** Wachten tot de splash weg is en de kaart geladen; korter en je audit halve UI. */
const SETTLE_MS = 2600;

function todayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function startPreview() {
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return server;
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // Nog niet op; opnieuw proberen.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`vite preview kwam niet op binnen ${timeoutMs} ms.`);
}

const MOBILE = { width: 414, height: 900 };
const DESKTOP = { width: 1440, height: 950 };

/**
 * De toestanden die wezenlijk andere opmaak opleveren. Een dialoog audit je niet
 * mee als hij dicht is, en de mobiele en desktop-indeling verschillen hier
 * genoeg (de kaart zit op mobiel in een modal) om beide te doorlopen.
 */
const SCENARIOS = [
  { label: "mobiel, startpagina", viewport: MOBILE },
  { label: "desktop, startpagina", viewport: DESKTOP },
  {
    label: "desktop, alles uitgeklapt",
    viewport: DESKTOP,
    async prepare(page) {
      await page.getByRole("button", { name: /Reisinfo/ }).click();
      await page.getByRole("button", { name: /Samenvatting/ }).click();
      for (const toggle of await page.getByRole("button", { name: /Foto's/ }).all()) {
        await toggle.scrollIntoViewIfNeeded();
        // force: de plakkende regiokop kan het doel net overlappen.
        await toggle.click({ force: true });
      }
      await page.waitForTimeout(900);
    },
  },
  {
    label: "mobiel, kaart in beeldvullende modal",
    viewport: MOBILE,
    async prepare(page) {
      await page.evaluate(() => window.scrollBy(0, 2600));
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: "Kaart openen" }).click();
      await page.waitForTimeout(1500);
    },
  },
  {
    label: "desktop, instellingen",
    viewport: DESKTOP,
    async prepare(page) {
      await page.getByRole("button", { name: "Instellingen" }).click();
      await page.waitForTimeout(700);
    },
  },
  {
    label: "desktop, fotoweergave",
    viewport: DESKTOP,
    async prepare(page) {
      await page.getByRole("button", { name: /Foto's/ }).first().click();
      await page.waitForTimeout(700);
      await page.getByRole("button", { name: /foto 1 van/ }).first().click();
      await page.waitForTimeout(900);
    },
  },
];

async function run() {
  const server = startPreview();
  let failures = 0;

  try {
    await waitForServer();
    const browser = await chromium.launch();

    for (const scenario of SCENARIOS) {
      const context = await browser.newContext({ viewport: scenario.viewport });
      await context.addInitScript(SKIP_DAILY_FLOURISH, todayKey());
      const page = await context.newPage();

      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(SETTLE_MS);
      if (scenario.prepare) await scenario.prepare(page);

      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

      if (violations.length === 0) {
        console.log(`  ✓ ${scenario.label}`);
      } else {
        failures += violations.length;
        console.log(`  ✗ ${scenario.label}`);
        for (const violation of violations) {
          console.log(`      [${violation.impact}] ${violation.id}: ${violation.help}`);
          for (const node of violation.nodes.slice(0, 5)) {
            console.log(`         ${node.target.join(" ")}`);
          }
          if (violation.nodes.length > 5) console.log(`         (+${violation.nodes.length - 5} meer)`);
          console.log(`         ${violation.helpUrl}`);
        }
      }

      await context.close();
    }

    await browser.close();
  } finally {
    server.kill();
  }

  if (failures > 0) {
    console.error(`\n${failures} toegankelijkheidsprobleem(en) gevonden.\n`);
    process.exit(1);
  }
  console.log(`\nGeen toegankelijkheidsproblemen in ${SCENARIOS.length} toestanden.\n`);
}

await run();
