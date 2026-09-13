import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const payload = readFileSync(join(FIX, "G.json"), "utf8");
const id = JSON.parse(payload).state.activeDiagramId;
const DELAY = Number(process.argv[2] ?? 450);
const EVENT = process.argv[3] ?? "pagehide";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
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
const read = () => page.evaluate(({ k, id }) => {
  const raw = localStorage.getItem(k); if (!raw) return null;
  return JSON.parse(raw).state.diagrams["audit-G"].nodeLayouts[id];
}, { k: KEY, id: t.id });
const before = await read();
await page.mouse.move(t.x, t.y); await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(t.x + 15 * i, t.y + 6 * i, { steps: 1 }); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(DELAY);
const beforeEvent = await read();
await page.evaluate((ev) => {
  if (ev === "visibilitychange") {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  } else {
    window.dispatchEvent(new Event(ev));
  }
}, EVENT);
await page.waitForTimeout(60);            // no debounce can fire in 60ms (PERSIST_DEBOUNCE_MS = 1000)
const afterEvent = await read();
const moved = (a, b) => a.x !== b.x || a.y !== b.y;
console.log(`delay=${String(DELAY).padStart(4)}ms event=${EVENT.padEnd(18)} storedBeforeEvent=${moved(before, beforeEvent)} storedAfterEvent=${moved(before, afterEvent)}  (${before.x},${before.y}) -> (${afterEvent.x},${afterEvent.y})`);
await browser.close();
