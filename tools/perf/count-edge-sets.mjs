// Counts diagram-store writes during an edge gesture (waypoint/segment drag and
// label drag). Each store set() serializes the workspace for persist, so a
// workspace-sized JSON.stringify is a one-to-one proxy for one set().
import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const payload = readFileSync(join(FIX, "G.json"), "utf8");
const id = JSON.parse(payload).state.activeDiagramId;
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
await page.goto(`${APP}/model/${id}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector(".react-flow__node", { timeout: 300000 });
await page.waitForTimeout(4000); await page.bringToFront();

await page.evaluate(() => {
  window.__s = { on: false, all: 0, big: 0, ms: 0 };
  const oj = JSON.stringify;
  JSON.stringify = function (...a) {
    const t = performance.now(); const r = oj.apply(this, a);
    if (window.__s.on) {
      window.__s.all++; window.__s.ms += performance.now() - t;
      if (typeof r === "string" && r.length > 50000) window.__s.big++;
    }
    return r;
  };
});

// Pick a visible edge, click it to select (affordances need selection).
const edge = await page.evaluate(() => {
  const paths = [...document.querySelectorAll(".react-flow__edge-interaction, .react-flow__edge path")];
  for (const p of paths) {
    const r = p.getBoundingClientRect();
    if (r.width < 40 && r.height < 40) continue;
    if (r.left < 80 || r.top < 140 || r.right > innerWidth - 430 || r.bottom > innerHeight - 160) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const owner = hit?.closest?.(".react-flow__edge");
    if (owner) return { id: owner.getAttribute("data-id"), x: cx, y: cy };
  }
  return null;
});
if (!edge) { console.log("NO EDGE FOUND"); await browser.close(); process.exit(1); }
await page.mouse.click(edge.x, edge.y); await page.waitForTimeout(900);

const handle = await page.evaluate(() => {
  const hs = [...document.querySelectorAll('line[role="button"][aria-label], circle[role="button"][aria-label]')];
  for (const h of hs) {
    const r = h.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 80 || cy < 140 || cx > innerWidth - 430 || cy > innerHeight - 160) continue;
    return { tag: h.tagName, label: h.getAttribute("aria-label"), x: cx, y: cy };
  }
  return null;
});
console.log("selected edge:", edge.id, "handle:", handle);
if (!handle) { console.log("NO HANDLE"); await browser.close(); process.exit(1); }

const MOVES = 40;
await page.mouse.move(handle.x, handle.y);
await page.waitForTimeout(200);
await page.evaluate(() => { window.__s.all = 0; window.__s.big = 0; window.__s.ms = 0; window.__s.on = true; });
await page.mouse.down();
for (let i = 1; i <= MOVES; i++) {
  await page.mouse.move(handle.x + 2 * i, handle.y + 2 * i, { steps: 1 });
  await page.waitForTimeout(16);
}
const during = await page.evaluate(() => ({ all: window.__s.all, big: window.__s.big, ms: +window.__s.ms.toFixed(1) }));
await page.mouse.up();
await page.waitForTimeout(400);
const total = await page.evaluate(() => { window.__s.on = false; return { all: window.__s.all, big: window.__s.big, ms: +window.__s.ms.toFixed(1) }; });
console.log(`segment/waypoint drag, ${MOVES} moves:`);
console.log(`   during gesture : stringify=${during.all} workspace-sized=${during.big} (${during.ms} ms)`);
console.log(`   incl. pointerup: stringify=${total.all} workspace-sized=${total.big} (${total.ms} ms)`);
await browser.close();
