// A node drag still has to land in the store: position moved, parent resolved,
// and one Ctrl+Z putting it back. Item B stops the Canvas re-rendering per
// frame, so this is the behaviour that has to survive it.
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

const read = (nodeId) => page.evaluate((n) => {
  const raw = JSON.parse(localStorage.getItem("structura_diagram-store"));
  const d = raw.state.diagrams[raw.state.activeDiagramId];
  const layout = d.nodeLayouts[n];
  const component = d.snapshot.components[n];
  return { x: layout?.x, y: layout?.y, parentId: component?.parentId ?? null };
}, nodeId);

const before = await read(target.id);
const domBefore = await page.evaluate((n) => document.querySelector(`.react-flow__node[data-id="${n}"]`).style.transform, target.id);

await page.mouse.move(target.x, target.y);
await page.mouse.down();
for (let i = 1; i <= 25; i++) { await page.mouse.move(target.x + 8 * i, target.y + 4 * i, { steps: 1 }); await page.waitForTimeout(16); }
const domDuring = await page.evaluate((n) => document.querySelector(`.react-flow__node[data-id="${n}"]`).style.transform, target.id);
await page.mouse.up();
await page.waitForTimeout(6000);
const after = await read(target.id);

await page.click(".react-flow__pane", { position: { x: 5, y: 5 } });
await page.waitForTimeout(500);
await page.keyboard.press("Meta+z");
await page.waitForTimeout(6000);
const undone = await read(target.id);

console.log("node       ", target.id);
console.log("dom before ", domBefore);
console.log("dom during ", domDuring, domDuring !== domBefore ? "(moved during the gesture)" : "(DID NOT MOVE)");
console.log("store before", JSON.stringify(before));
console.log("store after ", JSON.stringify(after));
console.log("after undo  ", JSON.stringify(undone));
console.log("committed:", after.x !== before.x || after.y !== before.y || after.parentId !== before.parentId);
console.log("undo restored:", undone.x === before.x && undone.y === before.y && undone.parentId === before.parentId);
await browser.close();
