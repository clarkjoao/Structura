// Polls the persisted layout after a node drag and reports when (if) it lands.
import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const payload = readFileSync(join(FIX, "G.json"), "utf8");
const id = JSON.parse(payload).state.activeDiagramId;
const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.evaluate(({ k, p }) => { localStorage.clear(); localStorage.setItem(k, p); }, { k: KEY, p: payload });
await page.goto(`${APP}/model/${id}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector(".react-flow__node", { timeout: 300000 });
await page.waitForTimeout(4000); await page.bringToFront();

const target = await page.evaluate(() => {
  const ns = [...document.querySelectorAll(".react-flow__node")].filter((n) => !(n.getAttribute("data-id") || "").includes("panel"));
  for (const n of ns) { const r = n.getBoundingClientRect(); const idd = n.getAttribute("data-id");
    if (r.width < 8 || r.left < 60 || r.top < 110 || r.right > innerWidth - 420 || r.bottom > innerHeight - 150) continue;
    const x = r.left + 10, y = r.top + 10;
    if (document.elementFromPoint(x, y)?.closest?.(".react-flow__node")?.getAttribute("data-id") === idd) return { id: idd, x, y };
  } return null; });

const snap = () => page.evaluate((n) => {
  const raw = JSON.parse(localStorage.getItem("structura_diagram-store"));
  const d = raw.state.diagrams[raw.state.activeDiagramId];
  const scenes = Object.values(d.scenes ?? {}).map((s) => s.nodeLayouts?.[n]).filter(Boolean);
  return { base: d.nodeLayouts[n], scenes, dom: document.querySelector(`.react-flow__node[data-id="${n}"]`)?.style.transform };
}, target.id);

console.log("node", target.id);
console.log("t=-1  ", JSON.stringify(await snap()));
await page.mouse.move(target.x, target.y);
await page.mouse.down();
for (let i = 1; i <= 25; i++) { await page.mouse.move(target.x + 8 * i, target.y + 4 * i, { steps: 1 }); await page.waitForTimeout(16); }
await page.waitForTimeout(Number(process.env.SETTLE ?? 0));
await page.mouse.up();
let last = null;
for (let t = 1; t <= 5; t++) {
  await page.waitForTimeout(1000);
  last = await snap();
}
console.log("RESULT", process.env.SETTLE ?? "0", JSON.stringify({ storeX: last.base.x, storeY: last.base.y, dom: last.dom, committed: last.base.x !== 1400 }));
await browser.close();
