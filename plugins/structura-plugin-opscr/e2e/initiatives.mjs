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
/** Shows a Version (or the base) from the Versions panel — where initiatives are picked. */
const pickVersion = async (label) => {
  await page.getByRole("button", { name: /^View versions/ }).click();
  await page.getByRole("dialog").getByText(label, { exact: true }).first().click();
  if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
  await settle();
};
/** The pane's Save (Ctrl/Cmd+S needs the focus in the pane). */
const save = async () => {
  const button = page.getByRole("button", { name: /^(Save|Salvar)$/ });
  if (await button.isDisabled()) return; // nothing unsaved
  await button.click();
  await settle();
};

/** Opens one of the pane's tabs. */
const TABS = {
  overview: /^(Overview|Visão)/,
  initiatives: /^(Initiatives|Iniciativas)/,
  files: /^(Files|Arquivos)/,
  problems: /^(Problems|Problemas)/,
};
const openTab = (name) => page.getByRole("tab", { name: TABS[name] }).click();
/** The Overview's View list on the bound diagram. */
const picker = page.getByRole("radiogroup", { name: /^(Diagram|Diagrama)$/ });
/** Shows a View on the bound diagram ("" for the whole workspace). */
const pickView = async (view) => {
  await openTab("overview");
  await picker
    .getByRole(
      "radio",
      view ? { name: view, exact: true } : { name: /^(Whole workspace|Workspace inteiro)$/ },
    )
    .click();
};
await page.goto(`http://localhost:${PORT}/model/${DIAGRAM}`);
await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
await page.getByRole("button", { name: /^(Properties|Propriedades)$/ }).click();
await page.getByRole("button", { name: "opscr", exact: true }).click();
await page.getByRole("button", { name: /Bind to opscr folder|Vincular a uma pasta opscr/ }).click();
await page.getByRole("tab", { name: TABS.initiatives }).waitFor({ timeout: 30000 });
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
// The pane's tabs: the file tree with the editor, and the initiatives.
await openTab("files");
await check(
  (await page
    .locator('button[title="initiatives/order-events/order-events.opscr.yaml"]')
    .count()) === 1,
  "the Files tab lists the initiative's files in its folder",
);
await page.screenshot({ path: join(OUT, "initiatives-1-files.png") });
await openTab("initiatives");
await page.screenshot({ path: join(OUT, "initiatives-1-initiatives.png") });
await openTab("overview");
// Each View says which initiatives change it: the context view is the root only.
const rowOf = (view) =>
  picker
    .getByRole("listitem")
    .filter({ has: page.getByRole("radio", { name: view, exact: true }) });
await check(
  (await rowOf("shop-containers")
    .getByRole("button", { name: /Order events/ })
    .count()) === 1 &&
    (await rowOf("shop-context")
      .getByRole("button", { name: /Order events/ })
      .count()) === 0,
  "the View list marks the views the initiative changes, and only those",
);
await page.screenshot({ path: join(OUT, "initiatives-1-overview.png") });
// The pane's "Showing" picks the initiative's Version.
await page
  .getByRole("radiogroup", { name: /^(Showing|Mostrando)$/ })
  .getByRole("radio", { name: /Order events/ })
  .click();
await settle();
const version = await stored(DIAGRAM, "order-events");
await page.screenshot({ path: join(OUT, "initiatives-2-version.png") });
await check(
  !version.components.some((c) => c.name === "sessions"),
  "the Version drops the retired Cache",
);
// The changes view (on by default): what the initiative changes against the root.
const classOf = (name) =>
  page.evaluate(
    (name) =>
      [...document.querySelectorAll(".react-flow__node")]
        .filter((n) => n.textContent.includes(name))
        .map((n) => n.className)
        .join(" | "),
    name,
  );
await check(
  (await classOf("Shopping sessions")).includes("node-version-removed"),
  `the retired Cache is drawn as a ghost (${await classOf("Shopping sessions")})`,
);
await check(
  (await classOf("orders-api")).includes("node-diff-modified"),
  "orders-api is outlined as changed",
);
await check(
  (await classOf("order-events")).includes("node-diff-added"),
  "order-events is outlined as added",
);
await check(
  (await page.locator(".edge-version-removed").count()) > 0,
  "the retired Cache's edges are drawn as ghosts",
);
await check(
  await page.getByText(/Changes in Order events|Mudanças em Order events/).isVisible(),
  "the legend names the initiative",
);
await page.screenshot({ path: join(OUT, "initiatives-2b-changes.png") });
// Hidden from the legend, shown again from the Version panel.
await page.getByRole("button", { name: /^(Hide|Ocultar)$/ }).click();
await check(
  (await page.locator(".node-version-removed").count()) === 0,
  "hiding the changes view drops the ghosts",
);
await page.getByRole("button", { name: /^View versions/ }).click();
await page.getByLabel(/Show changes on the canvas|Mostrar mudanças no canvas/).check();
await page.keyboard.press("Escape");
await check(
  (await page.locator(".node-version-removed").count()) > 0,
  "the Version panel switches it back on",
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
await pickVersion("Base");
await pickView("shop-context");
await settle();
await pickView("");
await settle();
await pickVersion("Order events");
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
await openTab("overview");
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
const idOf = (name) => views.find((d) => d.name === name)?.id;
const versionsOf = (name) => views.find((d) => d.name === name)?.versions ?? [];
await check(
  ["Web shop — containers", "Orders API — components", "Web shop — production on AWS"].every(
    (name) => versionsOf(name).includes("order-events"),
  ) && versionsOf("Web shop — system context").length === 0,
  `only the View diagrams the initiative changes have its Version (${JSON.stringify(views.map((d) => [d.name, d.versions]))})`,
);
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
await save();
await settle();
await check(
  (await changedInitiative()).length === 0,
  `with View diagrams on, no initiative manifest changes (${(await changedInitiative()).join(", ")})`,
);

// Drilling in from the container Version opens the component diagram on the same Version.
await page.goto(`http://localhost:${PORT}/model/${idOf("Web shop — containers")}`);
await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
await settle();
const activeKey = (id) =>
  page.evaluate((id) => {
    const d = JSON.parse(localStorage.getItem("structura_diagram-store")).state.diagrams[id];
    return d.activeVersionId ? (d.versions[d.activeVersionId]?.key ?? null) : null;
  }, id);
await pickVersion("Order events");
await page.screenshot({ path: join(OUT, "initiatives-4-containers.png") });
await check(
  (await activeKey(idOf("Web shop — containers"))) === "order-events",
  "the container diagram shows the initiative's Version",
);
await page
  .locator(".react-flow__node", { hasText: "orders-api" })
  .first()
  .getByRole("button", { name: /Drill into/i })
  .first()
  .dispatchEvent("click");
await settle();
await check(
  page.url().endsWith(`/model/${idOf("Orders API — components")}`),
  "orders-api's drill-down opens the component diagram",
);
await check(
  (await activeKey(idOf("Orders API — components"))) === "order-events",
  "the component diagram opens on the same Version",
);
await check(
  (await page.locator(".react-flow__node", { hasText: "order-events" }).count()) > 0,
  "the component diagram draws the initiative's elements",
);
await page.screenshot({ path: join(OUT, "initiatives-5-drilled.png") });

// One place for initiatives: status from the Versions panel, promote previewed from Merge.
await page.goto(`http://localhost:${PORT}/model/${DIAGRAM}`);
await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
const initiativesTab = page.getByRole("tab", { name: TABS.initiatives });
if (!(await initiativesTab.isVisible())) {
  if (!(await page.getByRole("button", { name: /Reconnect folder|Reconectar/ }).isVisible())) {
    await page.getByRole("button", { name: "opscr", exact: true }).click();
  }
  await page
    .getByRole("button", { name: /Reconnect folder|Reconectar/ })
    .click({ timeout: 5000 })
    .catch(() => {});
}
await initiativesTab
  .waitFor({ timeout: 30000 })
  .catch(() => fail("the pane did not come back on the bound diagram"));
await openTab("initiatives");
await settle();
const initiativeText = async () =>
  page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await (
      await (await root.getDirectoryHandle("opscr-product")).getDirectoryHandle("initiatives")
    ).getDirectoryHandle("order-events");
    return (await (await dir.getFileHandle("initiative.opscr.yaml")).getFile()).text();
  });
// The tab lists the initiative with what it changes; its detail manages it.
const list = page.getByRole("list", { name: TABS.initiatives });
await check(
  /\+3/.test(await list.textContent()) && /−1/.test(await list.textContent()),
  `the list shows what the initiative changes (${await list.textContent()})`,
);
await list.getByRole("button", { name: /Order events/ }).click();
const detail = page.getByRole("region", { name: "Order events" });
await check(
  (await detail.textContent()).includes("Topic/order-events") &&
    (await detail.textContent()).includes("shop-containers"),
  "the detail lists the changes and the views they touch",
);
const backToRoot = detail.getByRole("button", { name: /^(Back to the root|Voltar à raiz)$/ });
const showOnCanvas = detail.getByRole("button", { name: /^(Show on canvas|Mostrar no canvas)$/ });
if (await backToRoot.isVisible()) await backToRoot.click();
await settle();
await check((await activeKey(DIAGRAM)) === null, "Back to the root shows the base");
await showOnCanvas.click();
await settle();
await check(
  (await activeKey(DIAGRAM)) === "order-events",
  "Show on canvas shows the initiative's Version",
);
// Another View on the bound diagram opens on the base.
await pickView("shop-containers");
await settle();
await check(
  (await activeKey(DIAGRAM)) === null,
  "switching the View goes back to the base Version",
);
await pickView("");
await settle();
// The detail stays open across tabs.
await openTab("initiatives");
const description = detail.getByLabel(/^(Description|Descrição)$/);
await description.fill("Orders publish events");
await description.blur();
await settle();
await page.screenshot({ path: join(OUT, "initiatives-5a-detail.png") });
await save();
await check(
  /description: "?Orders publish events/.test(await initiativeText()),
  "the description edited in the detail reaches the Initiative's file",
);
await detail.getByRole("button", { name: /^(Promote…|Promover…)$/ }).click();
await settle();
const previewCard = page.getByRole("region", {
  name: /Promote Order events|Promover Order events/,
});
await check(await previewCard.isVisible(), "Promote… opens the preview");
await check(
  (await previewCard.textContent()).includes("Topic/order-events") &&
    (await previewCard.textContent()).includes("Cache/sessions"),
  "the preview lists what it adds and retires",
);
await check(
  await previewCard
    .getByRole("button", { name: /^(Mark as done|Marcar como concluída)$/ })
    .isVisible(),
  "an initiative in progress offers Mark as done",
);
await previewCard.getByRole("button", { name: /^(Cancel|Cancelar)$/ }).click();
await check(!(await previewCard.isVisible()), "Cancel closes the preview");

await page.getByRole("button", { name: /^View versions/ }).click();
const dialog = page.getByRole("dialog");
await dialog.getByText("Order events", { exact: true }).first().hover();
await dialog.getByLabel(/^(Status)$/).selectOption("done");
await page.keyboard.press("Escape");
await settle();
await save();
await check(
  (await initiativeText()).includes("status: done"),
  "the status set in the Versions panel reaches the Initiative's file",
);

await page.getByRole("button", { name: /^View versions/ }).click();
await dialog.getByText("Order events", { exact: true }).first().hover();
await dialog
  .getByRole("button", { name: /Merge into base|Mesclar/ })
  .first()
  .click();
await page.keyboard.press("Escape");
await settle();
await check(await previewCard.isVisible(), "Merge in the Versions panel opens the preview");
await previewCard.screenshot({ path: join(OUT, "initiatives-5b-preview.png") });
await check(
  (await previewCard.textContent()).match(/write|gravar/) !== null,
  "a done initiative's preview lists the files it writes",
);
const before = await folder();
await check(
  Object.keys(before).some((p) => p.startsWith("initiatives/order-events/")),
  "nothing is written before Confirm",
);
await previewCard.getByRole("button", { name: /^(Promote|Promover)$/ }).click();
await settle();
await save();
const promoted = await folder();
await check(
  !Object.keys(promoted).some((p) => p.startsWith("initiatives/order-events/")) &&
    promoted["webshop.opscr.yaml"] !== before["webshop.opscr.yaml"],
  "Confirm promotes: the initiative folder is gone and the root has its changes",
);
await page.screenshot({ path: join(OUT, "initiatives-6-promoted.png") });

await check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
server.kill();
