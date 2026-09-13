import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const payload = readFileSync(join(FIX, "G.json"), "utf8");
const id = JSON.parse(payload).state.activeDiagramId;
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
await page.goto(`${APP}/model/${id}`, { waitUntil: "networkidle" });
await page.waitForSelector(".react-flow__node"); await page.waitForTimeout(2500); await page.bringToFront();

// instrument every localStorage write
await page.evaluate(() => {
  window.__w = [];
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    const t = performance.now();
    const r = orig.apply(this, arguments);
    window.__w.push({ k, bytes: String(v).length, ms: +(performance.now() - t).toFixed(1), at: +t.toFixed(0) });
    return r;
  };
});
const t = await page.evaluate(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
  for (const n of ns) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
    if (r.width < 8 || r.height < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
    const x = r.left + 10, y = r.top + 10;
    if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { id: idd, x, y };
  } return null; });
console.log("target", t);

async function phase(name, fn) {
  await page.evaluate(() => { window.__w.length = 0; });
  await fn();
  await page.waitForTimeout(1800);
  const w = await page.evaluate(() => window.__w.slice());
  console.log(`\n[${name}] localStorage.setItem calls = ${w.length}`);
  for (const x of w.slice(0, 8)) console.log(`   key=${x.k} bytes=${x.bytes} ms=${x.ms}`);
  const tot = w.reduce((a, b) => a + b.ms, 0);
  console.log(`   total setItem ms = ${tot.toFixed(1)}`);
}

await phase("click (select)", async () => { await page.mouse.click(t.x, t.y); });
await page.evaluate(() => console.log("focus after click:", document.activeElement?.className, document.activeElement?.getAttribute?.("data-id")));
const focused = await page.evaluate(() => ({ cls: document.activeElement?.className ?? "", id: document.activeElement?.getAttribute?.("data-id") ?? null, tag: document.activeElement?.tagName }));
console.log("\nactiveElement after click:", focused);

const before = await page.evaluate(({ id }) => document.querySelector(`.react-flow__node[data-id="${id}"]`)?.style.transform, { id: t.id });
await phase("ArrowRight", async () => { await page.keyboard.press("ArrowRight"); });
const after = await page.evaluate(({ id }) => document.querySelector(`.react-flow__node[data-id="${id}"]`)?.style.transform, { id: t.id });
console.log("moved by ArrowRight?", before !== after, before, "->", after);

// try focusing the node element explicitly
await page.evaluate(({ id }) => document.querySelector(`.react-flow__node[data-id="${id}"]`)?.focus(), { id: t.id });
const before2 = await page.evaluate(({ id }) => document.querySelector(`.react-flow__node[data-id="${id}"]`)?.style.transform, { id: t.id });
await phase("ArrowRight after explicit focus()", async () => { await page.keyboard.press("ArrowRight"); });
const after2 = await page.evaluate(({ id }) => document.querySelector(`.react-flow__node[data-id="${id}"]`)?.style.transform, { id: t.id });
console.log("moved after explicit focus?", before2 !== after2, before2, "->", after2);

await phase("drag (40 moves + up)", async () => {
  await page.mouse.move(t.x, t.y); await page.mouse.down();
  for (let i = 1; i <= 40; i++) { await page.mouse.move(t.x + 4 * i, t.y + 3, { steps: 1 }); await page.waitForTimeout(16); }
  await page.mouse.up();
});
await browser.close();
