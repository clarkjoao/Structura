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
await page.waitForSelector(".react-flow__node", { timeout: 300000 }); await page.waitForTimeout(3000); await page.bringToFront();
const dom = await page.evaluate(() => ({ nodes: document.querySelectorAll(".react-flow__node").length,
  edges: document.querySelectorAll(".react-flow__edge").length,
  labelRenderers: document.querySelectorAll(".react-flow__edgelabel-renderer").length }));
console.log("DOM:", dom);
const t = await page.evaluate(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
  for (const n of ns) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
    if (r.width < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
    const x = r.left + 10, y = r.top + 10;
    if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { id: idd, x, y };
  } return null; });
await page.mouse.click(t.x, t.y); await page.waitForTimeout(800);
await page.evaluate(() => {
  window.__qs = { total: 0, bySelector: {} };
  const patch = (proto, name) => { const orig = proto[name];
    proto[name] = function (sel) { if (window.__qs.on) { window.__qs.total++; window.__qs.bySelector[sel] = (window.__qs.bySelector[sel] || 0) + 1; } return orig.call(this, sel); }; };
  patch(Element.prototype, "querySelector"); patch(Document.prototype, "querySelector");
  window.__qs.on = false;
});
const MOVES = 40;
await page.mouse.move(t.x, t.y); await page.mouse.down();
await page.mouse.move(t.x + 6, t.y + 3, { steps: 1 }); await page.waitForTimeout(60);
await page.evaluate(() => { window.__qs.total = 0; window.__qs.bySelector = {}; window.__qs.on = true; });
for (let i = 1; i <= MOVES; i++) { await page.mouse.move(t.x + 6 + 4 * i, t.y + 3 + Math.sin(i / 5) * 12, { steps: 1 }); await page.waitForTimeout(16); }
const r = await page.evaluate((moves) => { window.__qs.on = false;
  const top = Object.entries(window.__qs.bySelector).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { total: window.__qs.total, perFrame: +(window.__qs.total / moves).toFixed(1), top }; }, MOVES);
await page.mouse.up(); await page.waitForTimeout(300);
console.log(`querySelector during ${MOVES} drag frames: total=${r.total}  perFrame=${r.perFrame}`);
for (const [sel, n] of r.top) console.log(`   ${String(n).padStart(6)}  ${sel}`);
await browser.close();
