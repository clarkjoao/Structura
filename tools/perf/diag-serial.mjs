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
await page.waitForSelector(".react-flow__node", { timeout: 300000 }); await page.waitForTimeout(4000); await page.bringToFront();

await page.evaluate(() => {
  window.__s = { stringify: [], parse: [], rafCount: 0, ricCount: 0, stacks: {}, capture: false };
  const oj = JSON.stringify;
  JSON.stringify = function (...a) { const t = performance.now(); const r = oj.apply(this, a);
    const rec = { ms: +(performance.now() - t).toFixed(2), len: typeof r === "string" ? r.length : 0 };
    if (window.__s.capture) {
      const st = (new Error().stack || "").split("\n").slice(2, 14).map((l) => l.trim().replace(/https?:\/\/[^ )]*\//, "")).join("\n      ");
      window.__s.stacks[st] = (window.__s.stacks[st] || 0) + 1;
    }
    window.__s.stringify.push(rec); return r; };
  const op = JSON.parse;
  JSON.parse = function (...a) { const t = performance.now(); const r = op.apply(this, a);
    window.__s.parse.push({ ms: +(performance.now() - t).toFixed(2), len: typeof a[0] === "string" ? a[0].length : 0 }); return r; };
  const oraf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { return oraf.call(window, (t) => { window.__s.rafCount++; return cb(t); }); };
  if (window.requestIdleCallback) { const oric = window.requestIdleCallback;
    window.requestIdleCallback = function (cb, o) { return oric.call(window, (d) => { window.__s.ricCount++; return cb(d); }, o); }; }
  window.__quiet = (ms, cap) => new Promise((res) => { let last = performance.now(); const t0 = performance.now(); let o;
    try { o = new PerformanceObserver((l) => { for (const e of l.getEntries()) last = Math.max(last, e.startTime + e.duration); });
      o.observe({ type: "longtask", buffered: false }); } catch {}
    const c = () => { if (performance.now() - last >= ms || performance.now() - t0 > cap) { o?.disconnect?.(); res(true); } else requestAnimationFrame(c); };
    requestAnimationFrame(c); });
  window.__armLong = () => { window.__L = []; window.__lo?.disconnect?.();
    window.__lo = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__L.push(+e.duration.toFixed(1)); });
    try { window.__lo.observe({ type: "longtask", buffered: false }); } catch {} };
});
const t = await page.evaluate(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
  for (const n of ns) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
    if (r.width < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
    const x = r.left + 10, y = r.top + 10;
    if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { id: idd, x, y };
  } return null; });
await page.mouse.click(t.x, t.y); await page.waitForTimeout(1200);
await page.evaluate(() => window.__quiet(900, 20000));
await page.evaluate(() => { window.__armLong(); window.__s.stringify.length = 0; window.__s.parse.length = 0; window.__s.rafCount = 0; window.__s.ricCount = 0; window.__s.stacks = {}; window.__s.capture = true; });
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(2500);
const r = await page.evaluate(() => {
  const sum = (a) => +a.reduce((x, y) => x + y.ms, 0).toFixed(1);
  return { long: window.__L, longSum: +window.__L.reduce((a, b) => a + b, 0).toFixed(0),
    stringifyCalls: window.__s.stringify.length, stringifyMs: sum(window.__s.stringify),
    stringifyBiggest: window.__s.stringify.slice().sort((a, b) => b.ms - a.ms).slice(0, 4),
    parseCalls: window.__s.parse.length, parseMs: sum(window.__s.parse),
    rafCount: window.__s.rafCount, ricCount: window.__s.ricCount,
    topStacks: Object.entries(window.__s.stacks).sort((a, b) => b[1] - a[1]).slice(0, 6) };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
