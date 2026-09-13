/**
 * Control: is the ~800ms `structura:recentDiagrams` write loop caused by the drag,
 * or is it already running at idle (no gesture at all)?
 * Usage: node probe-idle.mjs <G|M2|XG> <out.json> [reps] [watchMs]
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
const WATCH = Number(process.argv[5] ?? 20000);

const payload = readFileSync(join(FIX, `${FIXTURE}.json`), "utf8");
const diagramId = JSON.parse(payload).state.activeDiagramId;

const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

const reps = [];
for (let r = 0; r < REPS; r++) {
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
  await page.goto(`${APP}/model/${diagramId}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector(".react-flow__node", { timeout: 300000 });
  await page.bringToFront();
  // NO gesture at all. Arm immediately after first paint, watch WATCH ms.
  await page.evaluate(() => {
    window.__w = [];
    window.__origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      window.__w.push({ t: +performance.now().toFixed(0), k, bytes: typeof v === "string" ? v.length : -1 });
      return window.__origSet.call(this, k, v);
    };
    window.__L = [];
    window.__lo = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__L.push(+e.duration.toFixed(1)); });
    try { window.__lo.observe({ type: "longtask", buffered: false }); } catch {}
  });
  await page.waitForTimeout(WATCH);
  const out = await page.evaluate(() => {
    Storage.prototype.setItem = window.__origSet; window.__lo?.disconnect?.();
    const byKey = {};
    for (const x of window.__w) { byKey[x.k] = byKey[x.k] || { n: 0, bytes: 0 }; byKey[x.k].n++; byKey[x.k].bytes += x.bytes; }
    return { writes: window.__w.length, byKey, gaps: window.__w.slice(1, 10).map((x, i) => x.t - window.__w[i].t),
             longCount: window.__L.length, longTotal: +window.__L.reduce((a, b) => a + b, 0).toFixed(0) };
  });
  reps.push({ rep: r, ...out });
  console.log(`rep${r} writes=${out.writes} long=${out.longCount}/${out.longTotal}ms byKey=${JSON.stringify(out.byKey)} gaps=${JSON.stringify(out.gaps)}`);
}
writeFileSync(OUT, JSON.stringify(reps, null, 2));
await browser.close();
