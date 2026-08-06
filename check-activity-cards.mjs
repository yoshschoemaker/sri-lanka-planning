import { chromium } from "playwright";
const outDir = "/private/tmp/claude-501/-Users-yosh-Documents-Development-Prive-sri-lanka-planning/0757659c-9176-4de6-a345-62afd6140c6a/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
const errors = [];
page.on("console", (msg) => { if (msg.type()==="error") errors.push(msg.text()); });
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5175", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
// scroll to the Anuradhapura card (has must/nice mix + a daytrip activity)
const anuradhapura = page.locator("text=Anuradhapura").first();
await anuradhapura.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/activity-cards-1.png` });
console.log("errors:", errors);
await browser.close();
