/**
 * CPU-profile the drag COMMIT window and aggregate self time by function,
 * to name what runs for ~23s after mouse-up on the M2 fixture.
 * Usage: node profile-commit.mjs <G|M2|XG> <out.json> [reps] [captureMs]
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
const CAPTURE = Number(process.argv[5] ?? 26000);
const MOVES = 40;

const payload = readFileSync(join(FIX, `${FIXTURE}.json`), "utf8");
const diagramId = JSON.parse(payload).state.activeDiagramId;

const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });

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

function selfTime(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]); if (!n) continue;
    const dt = (profile.timeDeltas[i] ?? 0) / 1000;
    const f = n.callFrame;
    if (f.functionName === "(idle)") continue;
    total += dt;
    const url = (f.url || "").split("/").pop() || "";
    const key = `${f.functionName || "(anonymous)"} @ ${url}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + dt);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    .map(([k, v]) => ({ fn: k, ms: +v.toFixed(0), pct: +((v / total) * 100).toFixed(1) }));
  return { totalMs: +total.toFixed(0), top };
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
  await cdp.send("Profiler.start");
  await page.mouse.up();
  await page.waitForTimeout(CAPTURE);
  const { profile } = await cdp.send("Profiler.stop");
  const s = selfTime(profile);
  reps.push({ rep: r, target: t.id, ...s });
  console.log(`\n--- rep${r} target=${t.id} totalJs=${s.totalMs}ms ---`);
  for (const e of s.top.slice(0, 14)) console.log(`  ${String(e.ms).padStart(6)}ms ${String(e.pct).padStart(5)}%  ${e.fn}`);
}
writeFileSync(OUT, JSON.stringify(reps, null, 2));
await browser.close();
