/**
 * Is the ~23s drag-commit a repeated persist cycle?
 * Counts localStorage.setItem calls (and bytes) during the commit window,
 * plus rAF/paint count, on the M2 fixture.
 * Usage: node probe-persist.mjs <G|M2> <out.json> [reps]
 */
import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199";
const KEY = "structura_diagram-store";
const [FIXTURE, OUT] = process.argv.slice(2);
const REPS = Number(process.argv[4] ?? 3);
const MOVES = 40;

const payload = readFileSync(join(FIX, `${FIXTURE}.json`), "utf8");
const diagramId = JSON.parse(payload).state.activeDiagramId;

const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

async function freshPage() {
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
  await page.goto(`${APP}/model/${diagramId}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector(".react-flow__node", { timeout: 300000 });
  await page.bringToFront();
  await page.evaluate(() => {
    window.__quiet = (ms, cap) => new Promise((res) => { let last = performance.now(); const t0 = performance.now(); let o;
      try { o = new PerformanceObserver((l) => { for (const e of l.getEntries()) last = Math.max(last, e.startTime + e.duration); });
        o.observe({ type: "longtask", buffered: false }); } catch {}
      const c = () => { if (performance.now() - last >= ms || performance.now() - t0 > cap) { o?.disconnect?.(); res(+(performance.now() - t0).toFixed(0)); } else requestAnimationFrame(c); };
      requestAnimationFrame(c); });
    window.__armWrites = () => {
      window.__w = [];
      if (!window.__origSet) window.__origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        window.__w.push({ t: +performance.now().toFixed(0), k, bytes: typeof v === "string" ? v.length : -1 });
        return window.__origSet.call(this, k, v);
      };
    };
    window.__disarmWrites = () => { if (window.__origSet) Storage.prototype.setItem = window.__origSet; return window.__w || []; };
  });
  await page.evaluate(() => window.__quiet(900, 40000));
}

async function findLeaf() {
  return page.evaluate(() => {
    const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
    for (const n of ns) {
      const r = n.getBoundingClientRect(); const id = n.getAttribute("data-id");
      if (r.width < 8 || r.height < 8) continue;
      if (r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
      for (const [x, y] of [[r.left + 10, r.top + 10], [r.left + r.width / 2, r.top + 8]])
        if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === id) return { id, x, y };
    } return null; });
}

const reps = [];
for (let r = 0; r < REPS; r++) {
  await freshPage();
  const t = await findLeaf();
  await page.mouse.click(t.x, t.y);
  await page.evaluate(() => window.__quiet(900, 20000));
  await page.mouse.move(t.x, t.y); await page.mouse.down();
  for (let i = 1; i <= MOVES; i++) { await page.mouse.move(t.x + 4 * i, t.y + Math.sin(i / 4) * 12, { steps: 1 }); await page.waitForTimeout(16); }
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  await page.evaluate(() => window.__armWrites());
  await page.mouse.up();
  const wall = await page.evaluate(() => window.__quiet(1200, 120000));
  const w = await page.evaluate(() => window.__disarmWrites());
  const byKey = {};
  for (const x of w) { byKey[x.k] = byKey[x.k] || { n: 0, bytes: 0 }; byKey[x.k].n++; byKey[x.k].bytes += x.bytes; }
  const rep = { rep: r, target: t.id, wallMs: wall, writes: w.length, byKey,
                firstT: w[0]?.t ?? null, lastT: w[w.length - 1]?.t ?? null,
                gapsMs: w.slice(1, 12).map((x, i) => x.t - w[i].t) };
  reps.push(rep);
  console.log(`rep${r} wall=${wall}ms writes=${w.length} byKey=${JSON.stringify(byKey)} gaps=${JSON.stringify(rep.gapsMs)}`);
}
writeFileSync(OUT, JSON.stringify(reps, null, 2));
await browser.close();
