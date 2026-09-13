/**
 * Baseline / final measurement for the canvas node pipeline.
 * Three passes per fixture, 7 reps each:
 *   A  DOM mutations split by phase (move vs commit) + long tasks at commit + frame cadence
 *   B  CPU profile of the move phase -> JS ms per frame
 *   C  one store change outside a drag (arrow-key nudge) -> long tasks + wall time
 * Usage: node measure.mjs <G|XG> <out.json> [reps]
 */
import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199";
const KEY = "structura_diagram-store";
const FIXTURE = process.argv[2];
const OUT = process.argv[3];
const REPS = Number(process.argv[4] ?? 7);
const MOVES = 40;

const stats = (a) => {
  const b = [...a].sort((x, y) => x - y);
  if (!b.length) return { n: 0, med: 0, min: 0, max: 0, sum: 0 };
  return {
    n: b.length,
    med: +b[Math.floor(b.length / 2)].toFixed(2),
    min: +b[0].toFixed(2),
    max: +b[b.length - 1].toFixed(2),
    sum: +b.reduce((x, y) => x + y, 0).toFixed(1),
  };
};

async function load(page, key) {
  const payload = readFileSync(join(FIX, `${key}.json`), "utf8");
  const id = JSON.parse(payload).state.activeDiagramId;
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
  const t0 = Date.now();
  await page.goto(`${APP}/model/${id}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector(".react-flow__node", { timeout: 300000 });
  // settle: wait until node count stops growing
  let prev = -1, same = 0;
  while (same < 4) {
    await page.waitForTimeout(500);
    const n = await page.evaluate(() => document.querySelectorAll(".react-flow__node").length);
    if (n === prev) same++; else { same = 0; prev = n; }
    if (Date.now() - t0 > 300000) break;
  }
  await page.bringToFront();
  await page.evaluate(() => {
    window.__w = [];
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { const t = performance.now(); const r = orig.apply(this, arguments);
      window.__w.push({ k, bytes: String(v).length, ms: +(performance.now() - t).toFixed(2) }); return r; };
    window.__armLong = () => { window.__L = []; window.__lo2?.disconnect?.();
      window.__lo2 = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__L.push(+e.duration.toFixed(1)); });
      try { window.__lo2.observe({ type: "longtask", buffered: false }); } catch {} };
    window.__quiet = (ms, capMs) => new Promise((res) => { let last = performance.now(); const t0 = performance.now(); let o;
      try { o = new PerformanceObserver((l) => { for (const e of l.getEntries()) last = Math.max(last, e.startTime + e.duration); });
        o.observe({ type: "longtask", buffered: false }); } catch {}
      const c = () => { if (performance.now() - last >= ms || performance.now() - t0 > capMs) { o?.disconnect?.(); res(performance.now() - t0); } else requestAnimationFrame(c); };
      requestAnimationFrame(c); });
  });
  const dom = await page.evaluate(() => ({
    nodes: document.querySelectorAll(".react-flow__node").length,
    edges: document.querySelectorAll(".react-flow__edge").length,
    labels: document.querySelector(".react-flow__edgelabel-renderer")?.children.length ?? -1,
  }));
  return { loadMs: Date.now() - t0, dom };
}

async function findLeaf(page) {
  return page.evaluate(() => {
    const ns = [...document.querySelectorAll(".react-flow__node")]
      .filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
    for (const n of ns) {
      const id = n.getAttribute("data-id");
      const r = n.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
      for (const [x, y] of [[r.left + 10, r.top + 10], [r.left + r.width / 2, r.top + 8], [r.left + r.width / 2, r.top + r.height / 2]]) {
        if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === id)
          return { id, x, y };
      }
    }
    return null;
  });
}

const ARM_A = () => {
  const T = (s) => { const m = /transform:\s*([^;]+)/.exec(s || ""); return m ? m[1].trim() : ""; };
  const mk = () => ({ records: 0, style: 0, childList: 0, otherAttr: 0, xf: new Set(), touched: new Set() });
  window.__a = { phase: "idle", move: mk(), stop: mk(), frames: [], fm: 0, long: { move: [], stop: [] } };
  window.__obs?.disconnect?.();
  window.__obs = new MutationObserver((recs) => {
    const b = window.__a[window.__a.phase];
    for (const rec of recs) {
      window.__a.fm++;
      if (!b) continue;
      b.records++;
      let node = rec.target;
      while (node && node.nodeType === 1 && !node.classList?.contains?.("react-flow__node")) node = node.parentElement;
      const id = node?.nodeType === 1 ? node.getAttribute("data-id") : null;
      if (rec.type === "childList") { b.childList++; continue; }
      if (rec.attributeName === "style") {
        b.style++;
        if (id) {
          b.touched.add(id);
          if (rec.target === node && T(rec.oldValue) !== (node.style.transform || "")) b.xf.add(id);
        }
      } else b.otherAttr++;
    }
  });
  window.__obs.observe(document.querySelector(".react-flow"), { subtree: true, attributes: true, attributeOldValue: true, childList: true });
  window.__lo?.disconnect?.();
  window.__lo = new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      const b = window.__a.long[window.__a.phase];
      if (b) b.push(+e.duration.toFixed(1));
    }
  });
  try { window.__lo.observe({ type: "longtask", buffered: false }); } catch {}
  const tick = (t) => { window.__a.frames.push({ t: Math.round(t), m: window.__a.fm, p: window.__a.phase }); window.__a.fm = 0; window.__a.raf = requestAnimationFrame(tick); };
  window.__a.raf = requestAnimationFrame(tick);
};

const HARVEST_A = () => {
  cancelAnimationFrame(window.__a.raf);
  window.__obs.disconnect(); window.__lo?.disconnect?.();
  const A = window.__a;
  const pack = (b) => ({ records: b.records, style: b.style, childList: b.childList, otherAttr: b.otherAttr,
    nodesTouched: b.touched.size, nodesTransformChanged: b.xf.size });
  const mf = A.frames.filter((f) => f.p === "move");
  const d = []; for (let i = 1; i < mf.length; i++) d.push(mf[i].t - mf[i - 1].t);
  return { move: pack(A.move), stop: pack(A.stop),
    moveFrames: mf.length, frameDeltaMs: d, moveFrameMuts: mf.map((f) => f.m),
    longMove: A.long.move, longStop: A.long.stop };
};

function aggregateProfile(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  let idle = 0, program = 0, total = 0;
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]); if (!n) continue;
    const dt = (profile.timeDeltas[i] ?? 0) / 1000;
    total += dt;
    const fn = n.callFrame.functionName;
    if (fn === "(idle)") { idle += dt; continue; }
    if (fn === "(program)") { program += dt; continue; }
    const k = `${fn || "(anon)"}@${(n.callFrame.url || "").split("/").pop()}:${n.callFrame.lineNumber + 1}`;
    self.set(k, (self.get(k) ?? 0) + dt);
  }
  const js = [...self.values()].reduce((a, b) => a + b, 0);
  return { totalMs: +total.toFixed(1), idleMs: +idle.toFixed(1), programMs: +program.toFixed(1), jsMs: +js.toFixed(1),
    top: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => ({ fn: k, ms: +v.toFixed(1) })) };
}

async function dragOnce(page, t, dir) {
  await page.mouse.move(t.x, t.y);
  await page.mouse.down();
  await page.evaluate(() => { if (window.__a) window.__a.phase = "move"; });
  for (let i = 1; i <= MOVES; i++) {
    await page.mouse.move(t.x + dir * (160 * i) / MOVES, t.y + Math.sin(i / 4) * 12, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => { if (window.__a) window.__a.phase = "stop"; });
  await page.mouse.up();
  await page.waitForTimeout(1500);
}

async function run() {
  const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  const consoleWarns = new Map();
  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") { const k = m.text().slice(0, 90); consoleWarns.set(k, (consoleWarns.get(k) ?? 0) + 1); } });

  const meta = await load(page, FIXTURE);
  console.log(`[${FIXTURE}] loaded in ${meta.loadMs}ms  DOM:`, meta.dom);

  const out = { fixture: FIXTURE, meta, passA: [], passB: [], passC: [], consoleSampleDuringDrag: null };

  // ---------- Pass A ----------
  for (let r = 0; r < REPS; r++) {
    const t = await findLeaf(page); if (!t) { out.passA.push({ rep: r, error: "no target" }); continue; }
    await page.mouse.click(t.x, t.y); await page.waitForTimeout(600);
    const t2 = (await findLeaf(page)) ?? t;
    await page.evaluate(ARM_A);
    await dragOnce(page, t2, r % 2 === 0 ? 1 : -1);
    const a = await page.evaluate(HARVEST_A);
    out.passA.push({ rep: r, target: t2.id, ...a });
    console.log(`  A${r} moveXf=${a.move.nodesTransformChanged} moveRec=${a.move.records} | stopRec=${a.stop.records} stopChild=${a.stop.childList} stopLong=${JSON.stringify(stats(a.longStop))}`);
    await page.waitForTimeout(400);
  }

  // ---------- Pass B ----------
  for (let r = 0; r < REPS; r++) {
    const t = await findLeaf(page); if (!t) { out.passB.push({ rep: r, error: "no target" }); continue; }
    await page.mouse.click(t.x, t.y); await page.waitForTimeout(600);
    const t2 = (await findLeaf(page)) ?? t;
    await page.mouse.move(t2.x, t2.y); await page.mouse.down();
    await page.mouse.move(t2.x + 6, t2.y + 3, { steps: 1 }); await page.waitForTimeout(60);
    await cdp.send("Profiler.start");
    const dir = r % 2 === 0 ? 1 : -1;
    for (let i = 1; i <= MOVES; i++) { await page.mouse.move(t2.x + 6 + dir * (160 * i) / MOVES, t2.y + 3 + Math.sin(i / 4) * 12, { steps: 1 }); await page.waitForTimeout(16); }
    const { profile } = await cdp.send("Profiler.stop");
    await page.mouse.up(); await page.waitForTimeout(1500);
    const agg = aggregateProfile(profile);
    out.passB.push({ rep: r, target: t2.id, moves: MOVES, ...agg });
    console.log(`  B${r} jsMs=${agg.jsMs} (${(agg.jsMs / MOVES).toFixed(2)}/frame) busy=${(agg.totalMs - agg.idleMs).toFixed(0)} idle=${agg.idleMs}`);
    await page.waitForTimeout(400);
  }

  // ---------- Pass C: one store change outside a drag ----------
  for (let r = 0; r < REPS; r++) {
    const t = await findLeaf(page); if (!t) { out.passC.push({ rep: r, error: "no target" }); continue; }
    await page.mouse.click(t.x, t.y);
    const settleMs = await page.evaluate(() => window.__quiet(900, 20000));
    // control window: prove the page is quiet before we touch anything
    await page.evaluate(() => { window.__armLong(); window.__w.length = 0; });
    await page.waitForTimeout(2000);
    const ctrl = await page.evaluate(() => ({ long: window.__L.slice() }));
    // measured window: exactly one store mutation (RF moveSelectedNodes -> updateNodeLayout -> one set())
    await page.evaluate(() => window.__quiet(900, 20000));
    await page.evaluate(() => { window.__armLong(); window.__w.length = 0; });
    const t0 = Date.now();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(2500);
    const c = await page.evaluate(() => ({ long: window.__L.slice(), writes: window.__w.slice() }));
    out.passC.push({ rep: r, target: t.id, settleMs, controlLong: ctrl.long, long: c.long, writes: c.writes, wallMs: Date.now() - t0 });
    console.log(`  C${r} settle=${Math.round(settleMs)}ms control=${JSON.stringify(stats(ctrl.long))} storeChange=${JSON.stringify(stats(c.long))} writes=${c.writes.length}/${c.writes.reduce((a, b) => a + b.ms, 0).toFixed(2)}ms`);
    await page.waitForTimeout(300);
  }

  out.consoleSampleDuringDrag = [...consoleWarns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  await browser.close();
  console.log("written", OUT);
}
await run();
