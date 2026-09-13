// Counts reads of `elementsSelectable` on the React Flow store during drag frames.
// The counter is installed by an init script that polls for the RF store and wraps
// getState() with a WeakMap-cached counting Proxy, so every component that mounts
// afterwards captures the patched getState (React caches getSnapshot per render).
import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

await page.addInitScript(() => {
  window.__sel = { on: false, count: 0, patched: false };
  const findStore = () => {
    const el = document.querySelector(".react-flow");
    if (!el) return null;
    const k = Object.keys(el).find((x) => x.startsWith("__reactFiber$"));
    if (!k) return null;
    let f = el[k];
    while (f) {
      const v = f.memoizedProps && f.memoizedProps.value;
      if (v && typeof v.getState === "function" && typeof v.subscribe === "function") {
        let st; try { st = v.getState(); } catch { st = null; }
        if (st && "elementsSelectable" in st && "nodeLookup" in st) return v;
      }
      f = f.return;
    }
    return null;
  };
  const tick = () => {
    if (!window.__sel.patched) {
      const store = findStore();
      if (store) {
        const cache = new WeakMap();
        const orig = store.getState.bind(store);
        store.getState = () => {
          const raw = orig();
          let p = cache.get(raw);
          if (!p) {
            p = new Proxy(raw, {
              get(t, key, r) {
                if (key === "elementsSelectable" && window.__sel.on) window.__sel.count++;
                return Reflect.get(t, key, r);
              },
            });
            cache.set(raw, p);
          }
          return p;
        };
        window.__sel.patched = true;
        window.__sel.patchedAt = performance.now();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const payload = readFileSync(join(FIX, "G.json"), "utf8");
const id = JSON.parse(payload).state.activeDiagramId;
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
await page.goto(`${APP}/model/${id}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector(".react-flow__node", { timeout: 300000 });
await page.waitForTimeout(4000); await page.bringToFront();

const dom = await page.evaluate(() => ({
  nodes: document.querySelectorAll(".react-flow__node").length,
  edges: document.querySelectorAll(".react-flow__edge").length,
  labelRenderers: document.querySelectorAll(".react-flow__edgelabel-renderer").length,
  patched: window.__sel.patched,
}));
console.log("DOM:", dom);

const t = await page.evaluate(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
  for (const n of ns) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
    if (r.width < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
    const x = r.left + 10, y = r.top + 10;
    if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { id: idd, x, y };
  } return null; });
await page.mouse.click(t.x, t.y); await page.waitForTimeout(900);

const MOVES = 40;
await page.mouse.move(t.x, t.y); await page.mouse.down();
await page.mouse.move(t.x + 6, t.y + 3, { steps: 1 }); await page.waitForTimeout(60);
await page.evaluate(() => { window.__sel.count = 0; window.__sel.on = true; });
for (let i = 1; i <= MOVES; i++) {
  await page.mouse.move(t.x + 6 + 4 * i, t.y + 3 + Math.sin(i / 5) * 12, { steps: 1 });
  await page.waitForTimeout(16);
}
const r = await page.evaluate((moves) => { window.__sel.on = false;
  return { total: window.__sel.count, perFrame: +(window.__sel.count / moves).toFixed(1) }; }, MOVES);
await page.mouse.up(); await page.waitForTimeout(300);
console.log(`elementsSelectable reads over ${MOVES} drag frames: total=${r.total} perFrame=${r.perFrame}`);
await browser.close();
