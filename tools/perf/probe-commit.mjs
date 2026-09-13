/**
 * Focused probe: the drag-COMMIT cost (mouse-up), which item 0's table asks for
 * but measure2.mjs only reports as a summed total. Here we keep each long task's
 * duration, and we record whether the gesture reparented the node — the prior
 * session's harness comment says a drag reparents, and reparenting into a populated
 * panel is the obvious suspect for the childList churn.
 *
 * Usage: node probe-commit.mjs <G|M2|XG> <label> <out.json> [reps]
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

async function freshPage() {
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
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

// read the persisted store to learn the node's parent before/after the gesture
const parentOf = (id) => page.evaluate((nid) => {
  const raw = localStorage.getItem("structura_diagram-store");
  if (!raw) return "(no store)";
  const s = JSON.parse(raw).state;
  const d = s.diagrams[s.activeDiagramId];
  const c = d?.snapshot?.components?.[nid];
  return c ? String(c.parentId) : "(missing)";
}, id);

const siblingCount = (pid) => page.evaluate((p) => {
  const raw = localStorage.getItem("structura_diagram-store");
  if (!raw) return -1;
  const s = JSON.parse(raw).state;
  const d = s.diagrams[s.activeDiagramId];
  return Object.values(d?.snapshot?.components ?? {}).filter((c) => String(c.parentId) === String(p)).length;
}, pid);

const reps = [];
for (let r = 0; r < REPS; r++) {
  const rep = { rep: r };
  try {
    await freshPage();
    rep.domNodes = await page.evaluate(() => document.querySelectorAll(".react-flow__node").length);
    const t = await findLeaf();
    if (!t) throw new Error("no target");
    rep.targetId = t.id;
    rep.parentBefore = await parentOf(t.id);
    await page.mouse.click(t.x, t.y);
    await page.evaluate(() => window.__quiet(900, 20000));
    await page.mouse.move(t.x, t.y); await page.mouse.down();
    for (let i = 1; i <= MOVES; i++) { await page.mouse.move(t.x + 4 * i, t.y + Math.sin(i / 4) * 12, { steps: 1 }); await page.waitForTimeout(16); }
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
    await page.evaluate(() => window.__armLong());
    const tUp = Date.now();
    await page.mouse.up();
    await page.waitForTimeout(6000);
    rep.commitWallMs = Date.now() - tUp;
    const L = await page.evaluate(() => { window.__lo?.disconnect?.(); return window.__L.slice(); });
    rep.longTasks = L;
    rep.longTotalMs = +L.reduce((a, b) => a + b, 0).toFixed(0);
    rep.longMaxMs = L.length ? Math.max(...L) : 0;
    rep.longCount = L.length;
    rep.parentAfter = await parentOf(t.id);
    rep.reparented = rep.parentBefore !== rep.parentAfter;
    rep.siblingsAfter = await siblingCount(rep.parentAfter);
  } catch (e) { rep.error = String(e).slice(0, 200); }
  reps.push(rep);
  console.log(`  rep${r}`, JSON.stringify(rep));
}

const summary = {
  label: LABEL, fixture: FIXTURE, reps: REPS,
  domNodes: reps.find((r) => r.domNodes)?.domNodes ?? null,
  targetId: reps.find((r) => r.targetId)?.targetId ?? null,
  parentBefore: reps.find((r) => r.parentBefore)?.parentBefore ?? null,
  parentAfter: reps.find((r) => r.parentAfter)?.parentAfter ?? null,
  reparented: reps.find((r) => r.reparented !== undefined)?.reparented ?? null,
  siblingsAfter: reps.find((r) => r.siblingsAfter !== undefined)?.siblingsAfter ?? null,
  longTotalMs: stat(reps.map((x) => x.longTotalMs)),
  longMaxMs: stat(reps.map((x) => x.longMaxMs)),
  longCount: stat(reps.map((x) => x.longCount)),
};
console.log("\nSUMMARY " + LABEL);
console.log(JSON.stringify(summary, null, 2));
writeFileSync(OUT, JSON.stringify({ summary, reps }, null, 2));
await browser.close();
