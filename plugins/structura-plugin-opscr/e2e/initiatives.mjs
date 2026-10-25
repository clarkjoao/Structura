#!/usr/bin/env node
/**
 * End-to-end check of opscr initiatives as Versions: bind the web-shop-product example (a product
 * root and one initiative), show the initiative's Version, check it draws the initiative's
 * elements and edges, save without editing and see no file changed, switch the View diagrams on
 * and check their Versions too (drill-down links included), then edit in the Version and see only
 * the initiative's files change.
 *
 *   (in the repo root) npm run build:plugins -- --no-build structura-plugin-opscr
 *   (here)             node e2e/initiatives.mjs
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
// The example as committed in the opscr checkout, so local edits there (a manual test bound to
// that folder, say) do not change what this script expects.
const opscrRoot = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const git = (...args) => execFileSync("git", ["-C", opscrRoot, ...args], { encoding: "utf8" });
const PREFIX = "examples/web-shop-product/";
const SAMPLE = Object.fromEntries(
  git("ls-tree", "-r", "--name-only", "HEAD", PREFIX)
    .split("\n")
    .filter((p) => p.startsWith(PREFIX) && !p.endsWith("README.md"))
    .map((path) => [path.slice(PREFIX.length), git("show", `HEAD:${path}`)]),
);

const PORT = 4181;
const DIAGRAM = "opscr-initiatives-e2e";

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
    diagrams: { [DIAGRAM]: emptyDiagram(DIAGRAM, "opscr initiatives e2e") },
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
  await page.screenshot({ path: join(OUT, "initiatives-failure.png") }).catch(() => {});
  await browser.close();
  server.kill();
  process.exit(1);
};
const check = async (condition, message) =>
  condition ? console.log(`ok   ${message}`) : fail(message);

await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
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
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("opscr-product", { create: true });
      // Seed the example once: picking the folder again must find what was saved in it.
      for (const [path, content] of Object.entries(files)) {
        const parts = path.split("/");
        let at = dir;
        for (const part of parts.slice(0, -1))
          at = await at.getDirectoryHandle(part, { create: true });
        const name = parts[parts.length - 1];
        const exists = await at.getFileHandle(name).then(
          () => true,
          () => false,
        );
        if (exists) continue;
        const writable = await (await at.getFileHandle(name, { create: true })).createWritable();
        await writable.write(content);
        await writable.close();
      }
      return dir;
    };
  },
  ["structura_diagram-store", seed, SAMPLE],
);

/** Every file of the folder, by path. */
const folder = () =>
  page.evaluate(async () => {
    const out = {};
    const walk = async (dir, at) => {
      for await (const [name, handle] of dir.entries()) {
        const path = at ? `${at}/${name}` : name;
        if (handle.kind === "directory") await walk(handle, path);
        else out[path] = await (await handle.getFile()).text();
      }
    };
    await walk(
      await (await navigator.storage.getDirectory()).getDirectoryHandle("opscr-product"),
      "",
    );
    return out;
  });
const changedInitiativeFiles = async () => {
  const now = await folder();
  const paths = new Set([...Object.keys(now), ...Object.keys(SAMPLE)]);
  return [...paths].filter((p) => p.startsWith("initiatives/") && now[p] !== SAMPLE[p]);
};
/** The initiative's manifests and lock that changed (its sidecar follows the boxes drawn). */
const changedInitiative = async () =>
  (await changedInitiativeFiles()).filter((p) => !p.endsWith("/opscr.layout.json"));
/** A diagram as stored, with the Version keyed `key` applied (what the canvas shows). */
const stored = (id, key) =>
  page.evaluate(
    ([id, key]) => {
      const d = JSON.parse(localStorage.getItem("structura_diagram-store")).state.diagrams[id];
      if (!d) return null;
      const v = key && Object.values(d.versions ?? {}).find((x) => x.key === key);
      const components = { ...d.snapshot.components };
      const connections = { ...d.snapshot.connections };
      if (v) {
        for (const id of v.removedComponentIds ?? []) delete components[id];
        for (const id of v.removedConnectionIds ?? []) delete connections[id];
        Object.assign(components, v.modifiedComponents ?? {}, v.addedComponents ?? {});
        Object.assign(connections, v.modifiedConnections ?? {}, v.addedConnections ?? {});
      }
      const name = (cid) => components[cid]?.name ?? `?${cid}`;
      return {
        name: d.name,
        components: Object.values(components).map((c) => ({
          name: c.name,
          link: c.linkedDiagramId ?? null,
        })),
        connections: Object.values(connections).map(
          (c) => `${name(c.sourceId)}->${name(c.targetId)}`,
        ),
        version: v ? { copies: Object.keys(v.baseHashes ?? {}).length } : null,
      };
    },
    [id, key],
  );
const settle = () => page.waitForTimeout(2500);
/** The pane's Save (Ctrl/Cmd+S needs the focus in the pane). */
const save = async () => {
  const button = page.getByRole("button", { name: /^(Save|Salvar)$/ });
  if (await button.isDisabled()) return; // nothing unsaved
  await button.click();
  await settle();
};

await page.goto(`http://localhost:${PORT}/model/${DIAGRAM}`);
await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
await page.getByRole("button", { name: /^(Properties|Propriedades)$/ }).click();
await page.getByRole("button", { name: "opscr", exact: true }).click();
await page.getByRole("button", { name: /Bind to opscr folder|Vincular a uma pasta opscr/ }).click();
await page
  .getByRole("button", { name: /^(Show|Mostrar)$/ })
  .first()
  .waitFor({ timeout: 30000 });
await settle();
const base = await stored(DIAGRAM);
await check(
  base.components.some((c) => c.name === "sessions"),
  "the base draws the root (sessions)",
);
await check(
  !base.components.some((c) => c.name === "order-events"),
  "the base does not draw the initiative",
);
await page.screenshot({ path: join(OUT, "initiatives-1-base.png") });

await page
  .getByRole("button", { name: /^(Show|Mostrar)$/ })
  .first()
  .click();
await settle();
const version = await stored(DIAGRAM, "order-events");
await page.screenshot({ path: join(OUT, "initiatives-2-version.png") });
await check(
  !version.components.some((c) => c.name === "sessions"),
  "the Version drops the retired Cache",
);
for (const edge of [
  "orders-api->order-events",
  "orders-service->order-events",
  "order-events->notifications-worker",
  "storefront->sessions-store",
]) {
  await check(
    version.connections.includes(edge),
    `the Version draws the initiative's edge ${edge}`,
  );
}

await save();
await settle();
await check(
  (await changedInitiativeFiles()).length === 0,
  `saving without an edit changes no initiative file, sidecar included (${(await changedInitiativeFiles()).join(", ")})`,
);
const rootLayout = (await folder())["opscr.layout.json"];
await check(
  rootLayout === SAMPLE["opscr.layout.json"],
  "drawing alone leaves the root's sidecar as it was",
);
await check(
  version.version.copies === 1,
  `the Version copies only the root element the initiative changes (${version.version.copies})`,
);
// The initiative's new elements overlap nothing but the panels holding them.
const overlapping = await page.evaluate(() => {
  const rects = [...document.querySelectorAll(".react-flow__node")].map((n) => ({
    name:
      n.querySelector("[data-testid], .font-semibold, span")?.textContent ??
      n.textContent.slice(0, 30),
    text: n.textContent,
    r: n.getBoundingClientRect(),
  }));
  const contains = (a, b) =>
    a.left <= b.left && a.top <= b.top && a.right >= b.right && a.bottom >= b.bottom;
  const hits = [];
  for (const a of rects.filter((x) =>
    /order-events|notifications-worker|sessions-store/.test(x.text),
  )) {
    for (const b of rects) {
      if (a === b || contains(a.r, b.r) || contains(b.r, a.r)) continue;
      if (
        a.r.left < b.r.right &&
        b.r.left < a.r.right &&
        a.r.top < b.r.bottom &&
        b.r.top < a.r.bottom
      )
        hits.push(`${a.text.slice(0, 20)} × ${b.text.slice(0, 20)}`);
    }
  }
  return hits;
});
await check(
  overlapping.length === 0,
  `the initiative's new elements overlap nothing (${overlapping.join("; ")})`,
);
const sidecarText = async () => (await folder())["initiatives/order-events/opscr.layout.json"];
const sidecarBefore = await sidecarText();

const drag = async (name, dx, dy) => {
  const box = await page.locator(".react-flow__node", { hasText: name }).first().boundingBox();
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 20 + dx, box.y + 10 + dy, { steps: 10 });
  await page.mouse.up();
  await settle();
};
const count = (list, name) => list.components.filter((c) => c.name === name).length;

// Showing a View on the bound diagram and coming back redraws the root with new canvas ids: the
// initiative's Version must follow them, not read the old ones as deleted.
const picker = page.getByRole("combobox", { name: /^(Diagram|Diagrama)$/ });
await page.getByRole("button", { name: /^(Show root|Mostrar raiz)$/ }).click();
await settle();
await picker.selectOption("shop-context");
await settle();
await picker.selectOption("");
await settle();
await page
  .getByRole("button", { name: /^(Show|Mostrar)$/ })
  .first()
  .click();
await settle();
const again = await stored(DIAGRAM, "order-events");
await check(
  count(again, "orders-api") === 1 &&
    count(again, "sessions") === 0 &&
    count(again, "order-events") === 1,
  `after a View round trip the Version is drawn again, without stale copies (${again.components.map((c) => c.name).join(",")})`,
);
await drag("notifications-worker", 60, 120);
await save();
await settle();
await check(
  (await changedInitiative()).length === 0 && (await sidecarText()) !== sidecarBefore,
  `a move in the Version changes only the initiative's sidecar (${(await changedInitiative()).join(", ")})`,
);
await page.screenshot({ path: join(OUT, "initiatives-3-round-trip.png") });

// The View diagrams: each gets the initiative's Version, with the base's links to other views.
await page
  .getByLabel(/A Structura diagram for each view|Um diagrama da Structura para cada view/)
  .check();
await settle();
await settle();
const diagrams = await page.evaluate(() =>
  Object.values(JSON.parse(localStorage.getItem("structura_diagram-store")).state.diagrams).map(
    (d) => ({
      id: d.id,
      name: d.name,
      versions: Object.values(d.versions ?? {}).map((v) => v.key),
    }),
  ),
);
const views = diagrams.filter((d) => d.id !== DIAGRAM);
await check(views.length === 4, `a diagram for each of the 4 views (${views.length})`);
await check(
  views.every((d) => d.versions.includes("order-events")),
  `each View diagram has the initiative's Version (${JSON.stringify(views.map((d) => d.versions))})`,
);
const idOf = (name) => views.find((d) => d.name === name)?.id;
const containers = await stored(idOf("Web shop — containers"), "order-events");
const containersBase = await stored(idOf("Web shop — containers"));
await check(
  containersBase.components
    .filter((b) => b.link && containers.components.some((c) => c.name === b.name))
    .every((b) => containers.components.find((c) => c.name === b.name).link === b.link),
  "the Version's boxes keep the base's links to other View diagrams",
);
await check(
  containers.components.find((c) => c.name === "orders-api")?.link ===
    idOf("Orders API — components"),
  "orders-api opens the component diagram in the Version",
);
await check(
  containers.components.find((c) => c.name === "order-events")?.link ===
    idOf("Web shop — production on AWS"),
  "a new element follows the view's default drill-down",
);
await check(
  containers.connections.includes("orders-api->order-events") &&
    containers.connections.includes("storefront->sessions-store"),
  `the container Version draws the initiative's edges (${containers.connections.join(",")})`,
);
const contextView = await stored(idOf("Web shop — system context"), "order-events");
await check(
  contextView.components.find((c) => c.name === "web-shop")?.link === idOf("Web shop — containers"),
  "the context Version's product opens the container diagram",
);
await save();
await settle();
await check(
  (await changedInitiative()).length === 0,
  `with View diagrams on, no initiative manifest changes (${(await changedInitiative()).join(", ")})`,
);

// Drilling in from the context Version opens the container diagram on the same Version.
await page.goto(`http://localhost:${PORT}/model/${idOf("Web shop — system context")}`);
await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
await settle();
const activeKey = (id) =>
  page.evaluate((id) => {
    const d = JSON.parse(localStorage.getItem("structura_diagram-store")).state.diagrams[id];
    return d.activeVersionId ? (d.versions[d.activeVersionId]?.key ?? null) : null;
  }, id);
await page.getByRole("button", { name: /^View versions/ }).click();
await page.getByRole("dialog").getByText("Order events", { exact: true }).click();
await page.keyboard.press("Escape");
await settle();
await page.screenshot({ path: join(OUT, "initiatives-4-context.png") });
await check(
  (await activeKey(idOf("Web shop — system context"))) === "order-events",
  "the context diagram shows the initiative's Version",
);
await page
  .locator(".react-flow__node", { hasText: "web-shop" })
  .first()
  .getByRole("button", { name: /Drill into/i })
  .first()
  .click();
await settle();
await check(
  page.url().endsWith(`/model/${idOf("Web shop — containers")}`),
  "the product's drill-down opens the container diagram",
);
await check(
  (await activeKey(idOf("Web shop — containers"))) === "order-events",
  "the container diagram opens on the same Version",
);
await check(
  (await page.locator(".react-flow__node", { hasText: "order-events" }).count()) > 0,
  "the container diagram draws the initiative's elements",
);
await page.screenshot({ path: join(OUT, "initiatives-5-drilled.png") });

await check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
server.kill();
