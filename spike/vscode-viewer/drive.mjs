// SPIKE driver: load the preview from a non-root path, post the graph, update it, screenshot.
import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
let bytes = 0;
const files = new Set();
page.on("response", async (r) => {
  try {
    const b = await r.body();
    bytes += b.length;
    files.add(r.url().split("/").pop());
  } catch {}
});
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));
const t0 = Date.now();
await page.goto("http://localhost:8765/host.html");
await page.evaluate(() => window.ready);
const tReady = Date.now() - t0;
await page.evaluate(() => window.send("graph.json"));
const frame = page.frames()[1];
try {
  await frame.waitForSelector(".react-flow__node", { timeout: 15000 });
} catch (e) {
  await page.screenshot({ path: "shot-fail.png" });
  console.log(
    "ERRORS",
    errors.slice(0, 2).map((e) => e.slice(0, 1500)),
    "HTML",
    (await frame.content()).slice(0, 600),
  );
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(1500);
const t1 = Date.now() - t0;
const nodes1 = await frame.locator(".react-flow__node").count();
const edges1 = await frame.locator(".react-flow__edge").count();
await page.screenshot({ path: "shot-1.png" });
const tu = Date.now();
await page.evaluate(() => window.send("graph2.json"));
await frame.waitForFunction(
  (n) => document.querySelectorAll(".react-flow__node").length > n,
  nodes1,
  { timeout: 20000 },
);
const tUpdate = Date.now() - tu;
await page.waitForTimeout(1000);
const nodes2 = await frame.locator(".react-flow__node").count();
const build = await frame.evaluate(() => window.__lastBuildMs);
await page.screenshot({ path: "shot-2.png" });
console.log(
  JSON.stringify(
    {
      tReady,
      tFirstRender: t1,
      nodes1,
      edges1,
      nodes2,
      tUpdate,
      buildMs: build,
      kbLoaded: Math.round(bytes / 1024),
      files: files.size,
      monaco: [...files].some((f) => f.includes("editor")),
      errors: errors.slice(0, 5),
    },
    null,
    1,
  ),
);
await browser.close();
