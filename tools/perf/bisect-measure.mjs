import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const LABEL = process.argv[2]; const OUT = process.argv[3]; const REPS = 3;
const med = (a) => { const b=[...a].sort((x,y)=>x-y); return b.length? b[Math.floor(b.length/2)] : 0; };

const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const payload = readFileSync(join(FIX, "G.json"), "utf8");
const id = JSON.parse(payload).state.activeDiagramId;

async function freshPage() {
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
  await page.goto(`${APP}/model/${id}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector(".react-flow__node", { timeout: 300000 });
  await page.waitForTimeout(3000); await page.bringToFront();
  await page.evaluate(() => {
    window.__armLong = () => { window.__L = []; window.__lo?.disconnect?.();
      window.__lo = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__L.push(+e.duration.toFixed(1)); });
      try { window.__lo.observe({ type: "longtask", buffered: false }); } catch {} };
    window.__quiet = (ms, cap) => new Promise((res) => { let last = performance.now(); const t0 = performance.now(); let o;
      try { o = new PerformanceObserver((l) => { for (const e of l.getEntries()) last = Math.max(last, e.startTime + e.duration); });
        o.observe({ type: "longtask", buffered: false }); } catch {}
      const c = () => { if (performance.now() - last >= ms || performance.now() - t0 > cap) { o?.disconnect?.(); res(true); } else requestAnimationFrame(c); };
      requestAnimationFrame(c); });
  });
}
async function findLeaf() {
  return page.evaluate(() => {
    const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
    for (const n of ns) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
      if (r.width < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
      const x = r.left + 10, y = r.top + 10;
      if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { id: idd, x, y };
    } return null; });
}

const storeChange = [], dragStop = [], moveRecs = [];
for (let r = 0; r < REPS; r++) {
  // every rep starts from a pristine diagram, so reps cannot contaminate each other
  await freshPage();
  const t = await findLeaf();
  await page.mouse.click(t.x, t.y);
  await page.evaluate(() => window.__quiet(900, 20000));
  await page.evaluate(() => window.__armLong());
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(2500);
  const c = await page.evaluate(() => window.__L.slice());
  storeChange.push(c.reduce((a, b) => a + b, 0));

  await freshPage();
  const t2 = await findLeaf();
  await page.mouse.click(t2.x, t2.y);
  await page.evaluate(() => window.__quiet(900, 20000));
  await page.evaluate(() => {
    window.__mv = 0; window.__on = false;
    window.__o?.disconnect?.();
    window.__o = new MutationObserver((recs) => { if (window.__on) window.__mv += recs.length; });
    window.__o.observe(document.querySelector(".react-flow"), { subtree: true, attributes: true, childList: true });
  });
  await page.mouse.move(t2.x, t2.y); await page.mouse.down();
  await page.evaluate(() => { window.__on = true; });
  for (let i = 1; i <= 40; i++) { await page.mouse.move(t2.x + 4 * i, t2.y + Math.sin(i / 4) * 12, { steps: 1 }); await page.waitForTimeout(16); }
  const mv = await page.evaluate(() => { window.__on = false; return window.__mv; });
  moveRecs.push(mv);
  await page.evaluate(() => window.__armLong());
  await page.mouse.up(); await page.waitForTimeout(2500);
  const s = await page.evaluate(() => window.__L.slice());
  dragStop.push(s.reduce((a, b) => a + b, 0));
}
const out = { label: LABEL, storeChangeLongMs: storeChange, storeChangeMed: med(storeChange),
  dragStopLongMs: dragStop, dragStopMed: med(dragStop), moveRecords: moveRecs, moveRecMed: med(moveRecs) };
console.log(`${LABEL.padEnd(22)} storeChange=${out.storeChangeMed}ms ${JSON.stringify(storeChange)}  dragStop=${out.dragStopMed}ms ${JSON.stringify(dragStop)}  moveRec=${out.moveRecMed} ${JSON.stringify(moveRecs)}`);
writeFileSync(OUT, JSON.stringify(out, null, 2));
await browser.close();
