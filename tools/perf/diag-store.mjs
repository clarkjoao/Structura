import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const FIXTURE = process.argv[2] ?? "G";
const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
const payload = readFileSync(join(FIX, `${FIXTURE}.json`), "utf8");
const id = JSON.parse(payload).state.activeDiagramId;
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
await page.goto(`${APP}/model/${id}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector(".react-flow__node", { timeout: 300000 }); await page.waitForTimeout(4000); await page.bringToFront();

await page.evaluate(() => {
  window.__w = [];
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { const t = performance.now(); const r = orig.apply(this, arguments);
    window.__w.push({ k, bytes: String(v).length, ms: +(performance.now() - t).toFixed(2) }); return r; };
  window.__armLong = () => { window.__L = []; window.__lo?.disconnect?.();
    window.__lo = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__L.push(+e.duration.toFixed(1)); });
    try { window.__lo.observe({ type: "longtask", buffered: false }); } catch {} };
  window.__quiet = (ms) => new Promise((res) => { let last = performance.now(); let o;
    try { o = new PerformanceObserver((l) => { for (const e of l.getEntries()) last = Math.max(last, e.startTime + e.duration); });
      o.observe({ type: "longtask", buffered: false }); } catch {}
    const c = () => { if (performance.now() - last >= ms) { o?.disconnect?.(); res(true); } else requestAnimationFrame(c); };
    requestAnimationFrame(c); });
});
const t = await page.evaluate(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
  for (const n of ns) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
    if (r.width < 8 || r.height < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
    const x = r.left + 10, y = r.top + 10;
    if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { id: idd, x, y };
  } return null; });
console.log("fixture", FIXTURE, "target", t.id);

const agg = (profile) => {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  let idle = 0, program = 0; const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) { const n = byId.get(profile.samples[i]); if (!n) continue;
    const dt = (profile.timeDeltas[i] ?? 0) / 1000; const fn = n.callFrame.functionName;
    if (fn === "(idle)") { idle += dt; continue; } if (fn === "(program)") { program += dt; continue; }
    const k = `${fn || "(anon)"}@${(n.callFrame.url || "").split("/").pop()}:${n.callFrame.lineNumber + 1}`;
    self.set(k, (self.get(k) ?? 0) + dt); }
  return { idle: +idle.toFixed(1), program: +program.toFixed(1),
    top: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v.toFixed(1).padStart(7)}  ${k}`) };
};

async function window_(name, action, profileIt) {
  await page.evaluate(() => window.__quiet(900));
  await page.evaluate(() => { window.__armLong(); window.__w.length = 0; });
  if (profileIt) await cdp.send("Profiler.start");
  const t0 = Date.now();
  await action();
  await page.waitForTimeout(2000);
  let prof = null;
  if (profileIt) prof = (await cdp.send("Profiler.stop")).profile;
  const r = await page.evaluate(() => ({ long: window.__L.slice(), writes: window.__w.slice() }));
  const sum = r.long.reduce((a, b) => a + b, 0);
  console.log(`\n[${name}] wall=${Date.now() - t0}ms longTasks=${r.long.length} sum=${sum.toFixed(0)}ms list=${JSON.stringify(r.long)}`);
  console.log(`   localStorage writes=${r.writes.length} totalMs=${r.writes.reduce((a, b) => a + b.ms, 0).toFixed(2)} ${JSON.stringify(r.writes.map((w) => w.k + ":" + w.bytes + ":" + w.ms))}`);
  if (prof) { const a = agg(prof); console.log(`   idle=${a.idle} program=${a.program}`); for (const l of a.top) console.log("   " + l); }
  return r;
}

await page.mouse.click(t.x, t.y); await page.waitForTimeout(1200);
await window_("CONTROL (nothing happens)", async () => {}, false);
await window_("ONE STORE CHANGE (ArrowRight on selected node)", async () => { await page.keyboard.press("ArrowRight"); }, true);
await window_("CONTROL again", async () => {}, false);
await window_("SELECTION CHANGE (click another node)", async () => {
  const o = await page.evaluate(() => { const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
    for (const n of ns.slice(5)) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
      if (r.width < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
      const x = r.left + 10, y = r.top + 10;
      if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { x, y }; } return null; });
  if (o) await page.mouse.click(o.x, o.y);
}, true);
await browser.close();
