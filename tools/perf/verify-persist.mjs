import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const payload = readFileSync(join(FIX, "G.json"), "utf8");
const id = JSON.parse(payload).state.activeDiagramId;
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
let page = await ctx.newPage();
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
await page.goto(`${APP}/model/${id}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector(".react-flow__node", { timeout: 300000 }); await page.waitForTimeout(4000); await page.bringToFront();
const t = await page.evaluate(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
  for (const n of ns) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
    if (r.width < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
    const x = r.left + 10, y = r.top + 10;
    if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { id: idd, x, y };
  } return null; });
const before = await page.evaluate(({ k, id }) => JSON.parse(localStorage.getItem(k)).state.diagrams["audit-G"].nodeLayouts[id], { k: KEY, id: t.id });
// drag, then close the tab as fast as the harness can
await page.mouse.move(t.x, t.y); await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(t.x + 15 * i, t.y + 6 * i, { steps: 1 }); await page.waitForTimeout(16); }
await page.mouse.up();
const closeDelay = Number(process.argv[2] ?? 0);
if (closeDelay) await page.waitForTimeout(closeDelay);
await page.close({ runBeforeUnload: true }); // actually runs the leave handlers
page = await ctx.newPage();            // same origin, same localStorage
await page.goto(APP, { waitUntil: "domcontentloaded" });
const after = await page.evaluate(({ k, id }) => JSON.parse(localStorage.getItem(k)).state.diagrams["audit-G"].nodeLayouts[id], { k: KEY, id: t.id });
const moved = before.x !== after.x || before.y !== after.y;
console.log(`closeDelay=${closeDelay}ms node=${t.id} before=(${before.x},${before.y}) after=(${after.x},${after.y}) survived=${moved}`);
await browser.close();
process.exit(moved ? 0 : 3);
