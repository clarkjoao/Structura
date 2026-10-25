#!/usr/bin/env node
/**
 * End-to-end check of opscr Views in the document pane: bind the web-app-aws example (a folder
 * with a context, a container, a component and a deployment view that drill into each other),
 * pick each view in the pane, follow a drill-down link, move a box and see it kept per view,
 * and go back to the whole workspace.
 *
 *   (in the repo root) npm run build:plugins -- --no-build structura-plugin-opscr
 *   (here)             node e2e/views.mjs
 *
 * Screenshots land in e2e/out/.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../..");
const OUT = join(here, "out");
mkdirSync(OUT, { recursive: true });
const require = createRequire(join(ROOT, "package.json"));
const { chromium } = require("playwright");
// The sample as committed in the opscr checkout, so local edits there (a manual test bound to
// that folder, say) do not change what this script expects.
const opscrRoot = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const git = (...args) => execFileSync("git", ["-C", opscrRoot, ...args], { encoding: "utf8" });
const SAMPLE = Object.fromEntries(
  git("ls-tree", "--name-only", "HEAD", "examples/web-app-aws/")
    .split("\n")
    .filter((p) => p.endsWith(".opscr.yaml"))
    .map((path) => [path.split("/").pop(), git("show", `HEAD:${path}`)]),
);

const PORT = 4180;
const DIAGRAM = "opscr-views-e2e";
/** An empty diagram to switch to while the folder is open. */
const OTHER = "opscr-views-e2e-other";
const CACHE = `
---
apiVersion: opscr.dev/v1
kind: Cache
metadata:
  name: price-cache
spec:
  provider: ElastiCache Redis
  description: Prices
`;
const EXTRA = `
---
apiVersion: opscr.dev/v1
kind: Storage
metadata:
  name: exports
spec:
  provider: S3
  description: Exports
`;

const emptyDiagram = (id, name) => ({
  id,
  name,
  domain: "",
  level: "container",
  description: "",
  snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
  nodeLayouts: {},
  edgeLayouts: {},
  viewport: { x: 0, y: 0, zoom: 0.5 },
  versions: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
const seed = JSON.stringify({
  state: {
    diagrams: {
      [DIAGRAM]: emptyDiagram(DIAGRAM, "opscr e2e"),
      [OTHER]: emptyDiagram(OTHER, "opscr e2e other"),
    },
    folders: {},
    userTemplates: {},
    services: {},
    activeDiagramId: DIAGRAM,
    past: [],
    future: [],
  },
  version: 15,
});

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: ROOT,
  stdio: "ignore",
});
const fail = async (message) => {
  console.error(`FAIL: ${message}`);
  await page.screenshot({ path: join(OUT, "failure.png") }).catch(() => {});
  await browser.close();
  server.kill();
  process.exit(1);
};
const check = async (condition, message) =>
  condition ? console.log(`ok   ${message}`) : fail(message);

await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], {
  origin: `http://localhost:${PORT}`,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => {
  errors.push(String(e));
  console.log(`pageerror: ${e.stack ?? e}`);
});
page.on("console", (m) => m.type() === "error" && console.log(`console: ${m.text()}`));

await page.addInitScript(
  ([storeKey, payload, files]) => {
    if (!localStorage.getItem(storeKey)) localStorage.setItem(storeKey, payload);
    // A chat connection whose endpoint the test answers (see the chat step).
    localStorage.setItem(
      "structura:llm:connections",
      JSON.stringify({
        connections: [
          {
            id: "e2e",
            name: "e2e",
            mode: "direct",
            provider: "openai",
            apiKey: "k",
            model: "gpt-4.1",
          },
        ],
        activeConnectionId: "e2e",
      }),
    );
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("opscr-views", { create: true });
      // Seed the sample once: picking the folder again must find what was saved in it.
      for (const [name, content] of Object.entries(files)) {
        const exists = await dir.getFileHandle(name).then(
          () => true,
          () => false,
        );
        if (exists) continue;
        const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await writable.write(content);
        await writable.close();
      }
      return dir;
    };
  },
  ["structura_diagram-store", seed, SAMPLE],
);

const nodes = () => page.locator(".react-flow__node").count();
const waitNodes = (n) =>
  page.waitForFunction((n) => document.querySelectorAll(".react-flow__node").length === n, n, {
    timeout: 20000,
  });
/** Opens one of the pane's tabs. */
const TABS = {
  overview: /^(Overview|Visão)/,
  initiatives: /^(Initiatives|Iniciativas)/,
  files: /^(Files|Arquivos)/,
  problems: /^(Problems|Problemas)/,
};
const openTab = (name) => page.getByRole("tab", { name: TABS[name] }).click();
await page.goto(`http://localhost:${PORT}/model/${DIAGRAM}`);
await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
// The views need the canvas's room: fold the inspector, the pane takes the side.
await page.getByRole("button", { name: /^(Properties|Propriedades)$/ }).click();
await page.getByRole("button", { name: "opscr", exact: true }).click();
await page.getByRole("button", { name: /Bind to opscr folder|Vincular a uma pasta opscr/ }).click();
const picker = page.getByRole("radiogroup", { name: /^(Diagram|Diagrama)$/ });
await picker.waitFor({ timeout: 30000 });
await check(
  (await picker.getByRole("radio").count()) === 5,
  "the pane lists the whole workspace and the four views",
);
/** The View the pane says the bound diagram shows. */
const pickedView = () => picker.getByRole("radio", { checked: true }).textContent();
/** Shows a View on the bound diagram ("" for the whole workspace). */
const pickView = (view) =>
  picker
    .getByRole(
      "radio",
      view ? { name: view, exact: true } : { name: /^(Whole workspace|Workspace inteiro)$/ },
    )
    .click();
const whole = await nodes();
await check(whole >= 8, `the whole workspace is drawn (${whole} elements)`);
await page.screenshot({ path: join(OUT, "views-0-whole.png") });

const show = async (view, count, label) => {
  await pickView(view);
  await waitNodes(count).catch(async () =>
    fail(`${label}: expected ${count} elements, got ${await nodes()}`),
  );
  await check((await nodes()) === count, `${label} draws ${count} elements`);
};
await show("shop-context", 3, "the context view");
await page.screenshot({ path: join(OUT, "views-1-context.png") });

// The system box opens the container view: follow the link in the pane.
// The boxes that open another view are folded under their summary.
await page.getByText(/^(Opens another view|Abre outra view) \(\d+\)$/).click();
await page.getByRole("button", { name: /webshop → shop-containers/ }).click();
await waitNodes(10).catch(async () =>
  fail(`drill-down: expected 10 elements, got ${await nodes()}`),
);
await check(
  (await pickedView()) === "shop-containers",
  "the drill-down link opens the container view",
);
await page.screenshot({ path: join(OUT, "views-2-containers.png") });

await page.getByRole("button", { name: /orders-api → orders-api-components/ }).click();
await waitNodes(8).catch(async () =>
  fail(`component view: expected 8 elements, got ${await nodes()}`),
);
await check(
  (await pickedView()) === "orders-api-components",
  "a container opens its component view",
);
await page.screenshot({ path: join(OUT, "views-3-components.png") });

await show("shop-production", 18, "the deployment view");
await page.screenshot({ path: join(OUT, "views-4-production.png") });

// A box the reader moves (staying inside its panel) stays where it is when the view is left and shown again.
await show("shop-containers", 10, "the container view again");
const before = await page
  .locator(".react-flow__node", { hasText: "storefront" })
  .first()
  .evaluate((n) => n.style.transform);
const box = await page
  .locator(".react-flow__node", { hasText: "storefront" })
  .first()
  .boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 2 - 60, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(1200);
const moved = await page
  .locator(".react-flow__node", { hasText: "storefront" })
  .first()
  .evaluate((n) => n.style.transform);
await check(moved !== before, "dragging a box moves it");
await show("shop-context", 3, "leaving for the context view");
await show("shop-containers", 10, "coming back to the container view");
const kept = await page
  .locator(".react-flow__node", { hasText: "storefront" })
  .first()
  .evaluate((n) => n.style.transform);
// The sidecar keeps whole pixels: a box drawn at a half pixel comes back within one.
const xy = (t) => /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(t).slice(1).map(Number);
await check(
  xy(kept).every((v, i) => Math.abs(v - xy(moved)[i]) <= 1),
  `the moved box is kept for that view (${moved} → ${kept})`,
);

await pickView("");
await waitNodes(whole).catch(async () =>
  fail(`whole workspace again: expected ${whole}, got ${await nodes()}`),
);
await check((await nodes()) === whole, "the whole workspace is back");

// A diagram of its own for each view (plugin API 1.13): switched on in the pane, the four diagrams
// appear in the app, each drawn from its view, and a box that opens another view opens its diagram.
const storedDiagrams = () =>
  page.evaluate(() => {
    const raw = localStorage.getItem("structura_diagram-store");
    return raw ? Object.values(JSON.parse(raw).state.diagrams) : [];
  });
await page.getByLabel(/A Structura diagram for each view/).check();
const deadline = Date.now() + 30000;
let made = [];
while (Date.now() < deadline) {
  made = (await storedDiagrams()).filter((d) => d.id !== DIAGRAM && d.id !== OTHER);
  if (made.length === 4 && made.every((d) => Object.keys(d.snapshot.components).length > 0)) break;
  await page.waitForTimeout(500);
}
await check(made.length === 4, `a diagram is made for each view (${made.length})`);
const byName = Object.fromEntries(made.map((d) => [d.name, d]));
const sizes = Object.fromEntries(
  made.map((d) => [d.name, Object.keys(d.snapshot.components).length]),
);
await check(
  sizes["Web shop — system context"] === 3 &&
    sizes["Web shop — containers"] === 10 &&
    sizes["Orders API — components"] === 8 &&
    sizes["Web shop — production on AWS"] === 18,
  `each is drawn from its view: ${JSON.stringify(sizes)}`,
);
const contextDiagram = byName["Web shop — system context"];
const containers = byName["Web shop — containers"];
const system = Object.values(contextDiagram.snapshot.components).find((c) => c.name === "webshop");
await check(
  system?.linkedDiagramId === containers.id,
  "the system box opens the container diagram",
);
await check(
  contextDiagram.level === "context" &&
    byName["Web shop — production on AWS"].level === "deployment",
  "the diagrams carry their level",
);
await page.screenshot({ path: join(OUT, "views-5-diagrams.png") });

// Opening one and drilling in with the app's own control (the card's explore button).
await page.goto(`http://localhost:${PORT}/model/${contextDiagram.id}`);
await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
await waitNodes(3).catch(() => fail("the context diagram did not draw 3 elements"));
await page
  .locator(".react-flow__node", { hasText: "webshop" })
  .first()
  .getByRole("button", { name: /Drill into/i })
  .first()
  .click();
await waitNodes(10).catch(async () =>
  fail(`drilling into the container diagram: got ${await nodes()} elements`),
);
await check(
  page.url().endsWith(`/model/${containers.id}`),
  "the system box's drill-down button opens the container diagram",
);
await page.screenshot({ path: join(OUT, "views-6-drilled.png") });

await check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
server.kill();
