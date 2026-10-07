/**
 * Smoke test of the embeddable preview (`npm run build:embed` → dist-embed/).
 *
 * Serves dist-embed/ from a sub-path (as a host with an unknown base does), loads it in an
 * iframe in headless Chromium, posts a graph, optionally a second one and a theme, and
 * reports render time, nodes on screen, whether elements present in both graphs kept their
 * screen position, and console errors. Screenshots land next to the first graph.
 *
 *   npm run build:embed
 *   node scripts/embed-smoke.mjs <graph.json> [updated-graph.json]
 *
 * A graph is a plugin importer result ({ components, connections }); the VSCode extension
 * and the opscr plugin produce them.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist-embed");
const [first, second] = process.argv.slice(2);
if (!first) {
  console.error("usage: node scripts/embed-smoke.mjs <graph.json> [updated-graph.json]");
  process.exit(2);
}
if (!existsSync(join(DIST, "embed.html"))) {
  console.error("dist-embed/embed.html not found — run `npm run build:embed` first");
  process.exit(2);
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const HOST = `<!doctype html><body style="margin:0">
<iframe id="f" src="/base/embed.html" style="border:0;width:1400px;height:900px"></iframe>
<script>
  const f = document.getElementById("f");
  window.ready = new Promise((r) => addEventListener("message", (e) => e.data?.type === "STRUCTURA_READY" && r()));
  window.post = (message) => f.contentWindow.postMessage(message, "*");
</script>`;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/") return res.end(HOST);
  const file = join(DIST, url.pathname.replace(/^\/base\//, ""));
  if (!url.pathname.startsWith("/base/") || !file.startsWith(DIST) || !existsSync(file)) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const graph = (path) => JSON.parse(readFileSync(path, "utf8"));
const positions = (frame) =>
  frame.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll(".react-flow__node")].map((n) => {
        const r = n.getBoundingClientRect();
        return [n.getAttribute("data-id"), [Math.round(r.x), Math.round(r.y)]];
      }),
    ),
  );

const t0 = Date.now();
await page.goto(`http://localhost:${port}/`);
await page.evaluate(() => window.ready);
await page.evaluate((g) => window.post({ type: "STRUCTURA_LOAD_GRAPH", ...g }), graph(first));
const frame = page.frames()[1];
await frame.waitForSelector(".react-flow__node", { timeout: 20000 });
await page.waitForTimeout(800);
const report = { firstRenderMs: Date.now() - t0, nodes: await positions(frame) };
const shots = dirname(resolve(first));
await page.screenshot({ path: join(shots, "embed-1.png") });

if (second) {
  const before = report.nodes;
  await page.evaluate((g) => window.post({ type: "STRUCTURA_LOAD_GRAPH", ...g }), graph(second));
  await frame
    .waitForFunction(
      (n) => document.querySelectorAll(".react-flow__node").length !== n,
      Object.keys(before).length,
      { timeout: 5000 },
    )
    .catch(() => {});
  await page.waitForTimeout(500);
  const after = await positions(frame);
  report.moved = Object.keys(before).filter(
    (id) => after[id] && (after[id][0] !== before[id][0] || after[id][1] !== before[id][1]),
  );
  report.nodesAfter = Object.keys(after).length;
  await page.screenshot({ path: join(shots, "embed-2.png") });
}

await page.evaluate(() => window.post({ type: "STRUCTURA_THEME", theme: "dark" }));
await page.waitForTimeout(300);
report.dark = await frame.evaluate(() => document.documentElement.classList.contains("dark"));
await page.screenshot({ path: join(shots, "embed-dark.png") });

report.nodes = Object.keys(report.nodes).length;
report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
server.close();
process.exit(errors.length > 0 || (report.moved?.length ?? 0) > 0 ? 1 : 0);
