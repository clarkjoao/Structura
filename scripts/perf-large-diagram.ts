// Measures the canvas on a large generated diagram (cypress/support/seed-large-diagram.ts).
//
// Usage (measure a production build — dev-mode React is several times slower
// and would hide the effect of a change):
//   npx vite build && npx vite preview --port 4173     # in another terminal
//   npm run perf:large                                  # prints a JSON report
//
// Environment:
//   STRUCTURA_URL       app origin (default http://localhost:4173)
//   PLAYWRIGHT_CHANNEL  e.g. "chrome" to drive an installed Chrome
//   PERF_RUNS           repeat the whole scenario N times and report medians (default 3)
//   PERF_OUT            also write the report to this path
//   HEADED=1            show the browser
//
// Each scenario reports frame timings (rAF deltas) and long tasks (>50 ms main
// thread blocks) captured inside the page. Numbers are for comparing a change
// against its baseline on the same machine, not absolute budgets.

import { writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { buildLargeDiagramSeed } from "../cypress/support/seed-large-diagram";
import { DIAGRAM_STORE_LOCAL_STORAGE_KEY } from "../cypress/support/seed-stress-diagram";

const BASE = (process.env.STRUCTURA_URL ?? "http://localhost:4173").replace(/\/$/, "");
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || undefined;
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const VIEWPORT = { width: 1600, height: 1000 };

interface PerfWindow {
  stop(): Sample;
}

interface Sample {
  durationMs: number;
  frames: number;
  fps: number;
  frameP50: number;
  frameP95: number;
  frameMax: number;
  longTasks: number;
  longTaskMs: number;
}

/** Installed before the app loads: a long-task log and a frame recorder. */
function instrument() {
  type LT = { start: number; duration: number };
  const longTasks: LT[] = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) longTasks.push({ start: e.startTime, duration: e.duration });
  }).observe({ type: "longtask", buffered: true });

  const pct = (sorted: number[], p: number) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]! : 0;

  const perf = {
    longTasks,
    lastLongTaskEnd: () => {
      const last = longTasks[longTasks.length - 1];
      return last ? last.start + last.duration : 0;
    },
    window() {
      const start = performance.now();
      const deltas: number[] = [];
      let prev = start;
      let running = true;
      const tick = (t: number) => {
        if (!running) return;
        deltas.push(t - prev);
        prev = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return {
        stop() {
          running = false;
          const end = performance.now();
          const inWindow = longTasks.filter((lt) => lt.start >= start && lt.start <= end);
          const sorted = [...deltas].sort((a, b) => a - b);
          const durationMs = end - start;
          return {
            durationMs: Math.round(durationMs),
            frames: deltas.length,
            fps: Math.round((deltas.length / durationMs) * 1000 * 10) / 10,
            frameP50: Math.round(pct(sorted, 0.5) * 10) / 10,
            frameP95: Math.round(pct(sorted, 0.95) * 10) / 10,
            frameMax: Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10,
            longTasks: inWindow.length,
            longTaskMs: Math.round(inWindow.reduce((sum, lt) => sum + lt.duration, 0)),
          };
        },
      };
    },
  };
  (window as unknown as { __perf: typeof perf }).__perf = perf;
}

/** Waits until the main thread has had no long task for `quietMs`. */
async function settle(page: Page, quietMs = 1500, timeoutMs = 60000) {
  await page.waitForFunction(
    (quiet) => {
      const perf = (window as unknown as { __perf: { lastLongTaskEnd(): number } }).__perf;
      return performance.now() - perf.lastLongTaskEnd() > quiet;
    },
    quietMs,
    { timeout: timeoutMs, polling: 100 },
  );
}

async function startWindow(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { window(): PerfWindow }; __win?: PerfWindow };
    w.__win = w.__perf.window();
  });
}

async function stopWindow(page: Page): Promise<Sample> {
  return page.evaluate(() => (window as unknown as { __win: PerfWindow }).__win.stop());
}

/** Main-thread work after a gesture ends: until the last long task that followed it. */
async function settleAfter(page: Page, sinceMs: number) {
  await settle(page, 800);
  return page.evaluate((since) => {
    const perf = (window as unknown as { __perf: { lastLongTaskEnd(): number } }).__perf;
    return Math.max(0, Math.round(perf.lastLongTaskEnd() - since));
  }, sinceMs);
}

const pageNow = (page: Page) => page.evaluate(() => performance.now());

async function domCounts(page: Page) {
  return page.evaluate(() => ({
    nodes: document.querySelectorAll(".react-flow__node").length,
    edges: document.querySelectorAll(".react-flow__edge").length,
    domElements: document.querySelectorAll("*").length,
  }));
}

/** The node's position on the canvas (its RF transform), unaffected by panning. */
async function flowPosition(page: Page, id: string) {
  return page
    .locator(`.react-flow__node[data-id="${id}"]`)
    .first()
    .evaluate((el) => {
      return (el as HTMLElement).style.transform;
    });
}

async function nodeCenter(page: Page, id: string, at: { fx: number; fy: number }) {
  const box = await page.locator(`.react-flow__node[data-id="${id}"]`).first().boundingBox();
  if (!box) throw new Error(`node ${id} is not on screen`);
  return { x: box.x + box.width * at.fx, y: box.y + box.height * at.fy };
}

async function dragFrom(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  // Paced like a real pointer: unpaced moves arrive in one task and React Flow
  // never sees a drag.
  const steps = 40;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

async function runOnce(seed: ReturnType<typeof buildLargeDiagramSeed>) {
  const browser = await chromium.launch({ channel: CHANNEL, headless: !process.env.HEADED });
  const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-US" });
  await context.addInitScript(
    ([key, payload]) => {
      if (sessionStorage.getItem("perf-seeded")) return;
      sessionStorage.setItem("perf-seeded", "1");
      localStorage.setItem("structura_language", "en");
      localStorage.setItem(key!, payload!);
    },
    [DIAGRAM_STORE_LOCAL_STORAGE_KEY, seed.localStoragePayload],
  );
  // tsx (esbuild keepNames) wraps functions in `__name(...)`; the page has no such helper.
  await context.addInitScript({ content: "globalThis.__name = (fn) => fn;" });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const result: Record<string, unknown> = {};

  // --- open -----------------------------------------------------------------
  const t0 = Date.now();
  await page.goto(`${BASE}/model/${seed.diagramId}`);
  await page.waitForSelector(".react-flow__node", { timeout: 60000 });
  const firstNodesMs = Date.now() - t0;
  await settle(page);
  const load = await page.evaluate(() => {
    const perf = (window as unknown as { __perf: { longTasks: { duration: number }[] } }).__perf;
    return {
      longTasks: perf.longTasks.length,
      longTaskMs: Math.round(perf.longTasks.reduce((s, lt) => s + lt.duration, 0)),
    };
  });
  result.open = { firstNodesMs, ...load, ...(await domCounts(page)) };
  const viewport = await page.locator(".react-flow__viewport").getAttribute("style");
  result.openViewport = viewport;

  const pane = await page.locator(".react-flow__renderer").boundingBox();
  if (!pane) throw new Error("canvas not found");
  const center = { x: pane.x + pane.width / 2, y: pane.y + pane.height / 2 };

  // --- drag one child node ------------------------------------------------------
  const leaf = seed.leafIds.find((id) => id.startsWith("leaf_"))!;
  const leafBefore = await flowPosition(page, leaf);
  const leafAt = await nodeCenter(page, leaf, { fx: 0.5, fy: 0.5 });
  await startWindow(page);
  await dragFrom(page, leafAt, 120, 60);
  const dragChild = await stopWindow(page);
  const childSettleMs = await settleAfter(page, await pageNow(page));
  const leafAfter = await flowPosition(page, leaf);
  result.dragChild = {
    ...dragChild,
    moved: leafBefore !== leafAfter,
    settleMs: childSettleMs,
  };
  // Clear the selection so the panel drag starts from the same state every run.
  await page.keyboard.press("Escape");
  await settle(page, 500);

  // --- drag the largest panel (97 children) -----------------------------------
  const panel = seed.largePanelIds[0]!;
  const before = await flowPosition(page, panel);
  // Panels drag by their header only; a press on the body starts a selection box.
  const header = await page
    .locator(`.react-flow__node[data-id="${panel}"] .panel-header`)
    .first()
    .boundingBox();
  if (!header) throw new Error(`panel ${panel} header is not on screen`);
  const panelAt = {
    x: header.x + Math.min(200, header.width / 2),
    y: header.y + header.height / 2,
  };
  await startWindow(page);
  await dragFrom(page, panelAt, 150, 90);
  const dragPanel = await stopWindow(page);
  const panelSettleMs = await settleAfter(page, await pageNow(page));
  const after = await flowPosition(page, panel);
  result.dragPanel = {
    ...dragPanel,
    moved: before !== after,
    settleMs: panelSettleMs,
  };

  // --- keyboard nudge: one store write per key press ----------------------------
  // The drags above commit once per gesture; this is the scenario where the
  // cost of a single store write (persist, projection, subscribers) adds up.
  const nudged = seed.leafIds.filter((id) => id.startsWith("leaf_"))[1]!;
  const nudgeBefore = await flowPosition(page, nudged);
  await page.mouse.click(
    ...(Object.values(await nodeCenter(page, nudged, { fx: 0.5, fy: 0.5 })) as [number, number]),
  );
  await settle(page, 500);
  await startWindow(page);
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(30);
  }
  const nudge = await stopWindow(page);
  const nudgeSettleMs = await settleAfter(page, await pageNow(page));
  result.nudge = {
    ...nudge,
    moved: nudgeBefore !== (await flowPosition(page, nudged)),
    settleMs: nudgeSettleMs,
  };
  await page.keyboard.press("Escape");
  await settle(page, 500);

  // --- pan at the opening zoom ------------------------------------------------
  await page.mouse.move(center.x, center.y);
  await startWindow(page);
  for (let i = 0; i < 60; i += 1) {
    await page.mouse.wheel(i < 30 ? 40 : -40, 60);
    await page.waitForTimeout(16);
  }
  result.pan = await stopWindow(page);
  await settle(page, 800);

  // --- zoom out and back in -----------------------------------------------------
  await startWindow(page);
  await page.keyboard.down("Control");
  for (let i = 0; i < 20; i += 1) {
    await page.mouse.wheel(0, i < 10 ? 40 : -40);
    await page.waitForTimeout(16);
  }
  await page.keyboard.up("Control");
  result.zoom = await stopWindow(page);
  await settle(page, 800);

  await browser.close();
  return result;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Median of every numeric field across runs; other fields come from the first run. */
function mergeRuns(runs: Record<string, unknown>[]) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(runs[0]!)) {
    const first = runs[0]![key];
    if (first && typeof first === "object") {
      const merged: Record<string, unknown> = {};
      for (const field of Object.keys(first)) {
        const values = runs.map((r) => (r[key] as Record<string, unknown>)[field]);
        merged[field] = values.every((v) => typeof v === "number")
          ? median(values as number[])
          : values[0];
      }
      out[key] = merged;
    } else out[key] = first;
  }
  return out;
}

const seed = buildLargeDiagramSeed();
const runs: Record<string, unknown>[] = [];
for (let i = 0; i < RUNS; i += 1) runs.push(await runOnce(seed));
const report = { url: BASE, runs: RUNS, fixture: seed.stats, ...mergeRuns(runs) };
const json = JSON.stringify(report, null, 2);
console.log(json);
if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, json + "\n");
