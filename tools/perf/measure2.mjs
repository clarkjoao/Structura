/**
 * Item 0 / Item 6 measurement, corrected protocol.
 *
 * The first harness ran all reps against one page. Each drag reparents a node,
 * so the diagram the later reps measured was not the diagram the earlier ones
 * measured, and the reps were not independent. Every rep here reloads the
 * fixture, so a run is N independent samples of the same starting state.
 *
 * Usage: node measure2.mjs <G|XG> <label> <out.json> [reps]
 */
import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199";
const KEY = "structura_diagram-store";
const [FIXTURE, LABEL, OUT] = process.argv.slice(2);
const REPS = Number(process.argv[5] ?? 7);
const MOVES = 40;

const stat = (a) => {
  const b = [...a].filter((x) => typeof x === "number").sort((x, y) => x - y);
  if (!b.length) return { med: null, min: null, max: null };
  return { med: +b[Math.floor(b.length / 2)].toFixed(1), min: +b[0].toFixed(1), max: +b[b.length - 1].toFixed(1) };
};

const payload = readFileSync(join(FIX, `${FIXTURE}.json`), "utf8");
const diagramId = JSON.parse(payload).state.activeDiagramId;

const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 100 });

async function freshPage() {
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
  const t0 = Date.now();
  await page.goto(`${APP}/model/${diagramId}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector(".react-flow__node", { timeout: 300000 });
  await page.bringToFront();
  await page.evaluate(() => {
    window.__armLong = () => { window.__L = []; window.__lo?.disconnect?.();
      window.__lo = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__L.push(+e.duration.toFixed(1)); });
      try { window.__lo.observe({ type: "longtask", buffered: false }); } catch {} };
    window.__quiet = (ms, cap) => new Promise((res) => { let last = performance.now(); const t0 = performance.now(); let o;
      try { o = new PerformanceObserver((l) => { for (const e of l.getEntries()) last = Math.max(last, e.startTime + e.duration); });
        o.observe({ type: "longtask", buffered: false }); } catch {}
      const c = () => { if (performance.now() - last >= ms || performance.now() - t0 > cap) { o?.disconnect?.(); res(+(performance.now() - t0).toFixed(0)); } else requestAnimationFrame(c); };
      requestAnimationFrame(c); });
  });
  const settle = await page.evaluate(() => window.__quiet(900, 30000));
  return { bootMs: Date.now() - t0, settleMs: settle };
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

const ARM_MUT = () => {
  const T = (s) => { const m = /transform:\s*([^;]+)/.exec(s || ""); return m ? m[1].trim() : ""; };
  const mk = () => ({ records: 0, childList: 0, xf: new Set() });
  window.__m = { phase: "off", move: mk(), stop: mk() };
  window.__mo?.disconnect?.();
  window.__mo = new MutationObserver((recs) => {
    const b = window.__m[window.__m.phase]; if (!b) return;
    for (const rec of recs) {
      b.records++;
      if (rec.type === "childList") { b.childList++; continue; }
      if (rec.attributeName !== "style") continue;
      let node = rec.target;
      while (node && node.nodeType === 1 && !node.classList?.contains?.("react-flow__node")) node = node.parentElement;
      if (node?.nodeType === 1 && rec.target === node) {
        const id = node.getAttribute("data-id");
        if (id && T(rec.oldValue) !== (node.style.transform || "")) b.xf.add(id);
      }
    }
  });
  window.__mo.observe(document.querySelector(".react-flow"), { subtree: true, attributes: true, attributeOldValue: true, childList: true });
};

function jsMs(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  let js = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]); if (!n) continue;
    const fn = n.callFrame.functionName;
    if (fn === "(idle)" || fn === "(program)") continue;
    js += (profile.timeDeltas[i] ?? 0) / 1000;
  }
  return +js.toFixed(1);
}

const reps = [];
for (let r = 0; r < REPS; r++) {
  const rep = { rep: r };
  try {
    // ---- A: drag, mutations by phase + long tasks at commit ----
    const boot = await freshPage();
    rep.bootMs = boot.bootMs; rep.settleMs = boot.settleMs;
    rep.dom = await page.evaluate(() => ({
      nodes: document.querySelectorAll(".react-flow__node").length,
      edges: document.querySelectorAll(".react-flow__edge").length,
      labelRenderers: document.querySelectorAll(".react-flow__edgelabel-renderer").length,
    }));
    const t = await findLeaf();
    if (!t) throw new Error("no target");
    await page.mouse.click(t.x, t.y);
    await page.evaluate(() => window.__quiet(900, 20000));
    await page.evaluate(ARM_MUT);
    await page.mouse.move(t.x, t.y); await page.mouse.down();
    await page.evaluate(() => { window.__m.phase = "move"; });
    for (let i = 1; i <= MOVES; i++) { await page.mouse.move(t.x + 4 * i, t.y + Math.sin(i / 4) * 12, { steps: 1 }); await page.waitForTimeout(16); }
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
    await page.evaluate(() => { window.__m.phase = "stop"; window.__armLong(); });
    await page.mouse.up();
    await page.waitForTimeout(2500);
    const a = await page.evaluate(() => { window.__mo.disconnect(); window.__lo?.disconnect?.();
      return { move: { records: window.__m.move.records, childList: window.__m.move.childList, xf: window.__m.move.xf.size },
               stop: { records: window.__m.stop.records, childList: window.__m.stop.childList, xf: window.__m.stop.xf.size },
               stopLong: window.__L.slice() }; });
    rep.moveRecords = a.move.records; rep.moveTransformNodes = a.move.xf;
    rep.stopRecords = a.stop.records; rep.stopChildList = a.stop.childList;
    rep.stopLongMs = +a.stopLong.reduce((x, y) => x + y, 0).toFixed(0); rep.stopLongCount = a.stopLong.length;

    // ---- B: JS per drag frame ----
    await freshPage();
    const t2 = await findLeaf();
    await page.mouse.click(t2.x, t2.y);
    await page.evaluate(() => window.__quiet(900, 20000));
    await page.mouse.move(t2.x, t2.y); await page.mouse.down();
    await page.mouse.move(t2.x + 6, t2.y + 3, { steps: 1 }); await page.waitForTimeout(60);
    await cdp.send("Profiler.start");
    for (let i = 1; i <= MOVES; i++) { await page.mouse.move(t2.x + 6 + 4 * i, t2.y + 3 + Math.sin(i / 5) * 12, { steps: 1 }); await page.waitForTimeout(16); }
    const { profile } = await cdp.send("Profiler.stop");
    await page.mouse.up(); await page.waitForTimeout(1200);
    rep.moveJsMsPerFrame = +(jsMs(profile) / MOVES).toFixed(2);

    // ---- C: one store change outside a drag ----
    await freshPage();
    const t3 = await findLeaf();
    await page.mouse.click(t3.x, t3.y);
    await page.evaluate(() => window.__quiet(900, 20000));
    await page.evaluate(() => window.__armLong());
    await page.waitForTimeout(1500);
    rep.controlLongMs = await page.evaluate(() => +window.__L.reduce((a, b) => a + b, 0).toFixed(0));
    await page.evaluate(() => window.__quiet(900, 20000));
    await page.evaluate(() => window.__armLong());
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(2500);
    const c = await page.evaluate(() => ({ long: window.__L.slice() }));
    rep.storeChangeLongMs = +c.long.reduce((x, y) => x + y, 0).toFixed(0);
    rep.storeChangeLongCount = c.long.length;
  } catch (e) { rep.error = String(e).slice(0, 160); }
  reps.push(rep);
  console.log(`  rep${r}`, JSON.stringify(rep));
}

const pick = (k) => stat(reps.map((x) => x[k]).filter((v) => v !== undefined));
const summary = {
  label: LABEL, fixture: FIXTURE, reps: REPS,
  dom: reps.find((r) => r.dom)?.dom ?? null,
  bootMs: pick("bootMs"),
  moveJsMsPerFrame: pick("moveJsMsPerFrame"),
  moveRecords: pick("moveRecords"),
  moveTransformNodes: pick("moveTransformNodes"),
  stopRecords: pick("stopRecords"),
  stopChildList: pick("stopChildList"),
  stopLongMs: pick("stopLongMs"),
  controlLongMs: pick("controlLongMs"),
  storeChangeLongMs: pick("storeChangeLongMs"),
};
console.log("\nSUMMARY " + LABEL);
console.log(JSON.stringify(summary, null, 2));
writeFileSync(OUT, JSON.stringify({ summary, reps }, null, 2));
await browser.close();
