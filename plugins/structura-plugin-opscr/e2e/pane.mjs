#!/usr/bin/env node
/**
 * End-to-end check of the opscr document pane in a production build of Structura.
 *
 * The folder picker cannot be driven headless, so `showDirectoryPicker` is replaced by a
 * folder in the origin-private file system holding the opscr sample — the same
 * FileSystemDirectoryHandle API the real picker returns. Then: bind, wait for the diagram,
 * add a Cache in the editor, drag an element, edit again, check the dragged element stayed,
 * undo one sync, remove the Cache again, save, and read the file back. Then the other way:
 * delete, undo and rename on the canvas, and read the patched files back.
 *
 *   (in the repo root) npm run build:plugins -- --no-build structura-plugin-opscr
 *   (here)             node e2e/pane.mjs
 *
 * Screenshots land in e2e/out/.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../..");
const OUT = join(here, "out");
mkdirSync(OUT, { recursive: true });
const require = createRequire(join(ROOT, "package.json"));
const { chromium } = require("playwright");
const sampleDir = join(
  dirname(createRequire(import.meta.url).resolve("opscr/package.json")),
  "examples/sample",
);
const SAMPLE = Object.fromEntries(
  readdirSync(sampleDir).map((f) => [f, readFileSync(join(sampleDir, f), "utf8")]),
);

const PORT = 4179;
const DIAGRAM = "opscr-e2e";
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

const seed = JSON.stringify({
  state: {
    diagrams: {
      [DIAGRAM]: {
        id: DIAGRAM,
        name: "opscr e2e",
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
      },
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
page.on("pageerror", (e) => errors.push(String(e)));
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
      const dir = await root.getDirectoryHandle("opscr-sample", { create: true });
      for (const [name, content] of Object.entries(files)) {
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
const nodeBox = (name) =>
  page.locator(".react-flow__node", { hasText: name }).first().boundingBox();
const editor = page.locator(".monaco-editor textarea").first();
/** Replaces the open file's text by pasting it: typing would go through auto-indent. */
let commerce = SAMPLE["commerce.opscr.yaml"];
const setEditorText = async (text) => {
  commerce = text;
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press("ControlOrMeta+v");
  // Monaco reads the clipboard asynchronously: let the paste land before the next key.
  await page.waitForTimeout(400);
};
const appendToEditor = (text) => setEditorText(commerce + text);

await page.goto(`http://localhost:${PORT}/model/${DIAGRAM}`);
await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
await page.getByRole("button", { name: "opscr", exact: true }).click();
await page.getByRole("button", { name: /Bind to opscr folder|Vincular a uma pasta opscr/ }).click();
await waitNodes(22).catch(() => fail("binding did not draw the 22 elements of the sample"));
await check((await nodes()) === 22, "bind draws the sample (22 elements)");
await page.screenshot({ path: join(OUT, "1-bound.png") });

await editor.waitFor({ timeout: 20000 });
await appendToEditor(CACHE);
await waitNodes(23).catch(() => fail("adding a Cache in the editor did not reach the canvas"));
await check(true, "an edit adds the Cache without saving");
await page.screenshot({ path: join(OUT, "2-cache.png") });

const before = await nodeBox("public-api");
await page.mouse.move(before.x + 20, before.y + 15);
await page.mouse.down();
await page.mouse.move(before.x + 120, before.y + 135, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(500);
const dragged = await nodeBox("public-api");
await check(Math.abs(dragged.y - before.y) > 50, "public-api was dragged");

await appendToEditor(EXTRA);
await waitNodes(24).catch(() => fail("a second edit did not reach the canvas"));
const after = await nodeBox("public-api");
await check(
  Math.abs(after.x - dragged.x) < 2 && Math.abs(after.y - dragged.y) < 2,
  "the dragged element stays put on the next sync",
);
await page.screenshot({ path: join(OUT, "3-dragged-kept.png") });

await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
await page.keyboard.press("ControlOrMeta+z");
await waitNodes(23).catch(() => fail("one undo did not revert one sync"));
await check(true, "one undo reverts one sync");

await setEditorText(SAMPLE["commerce.opscr.yaml"] + CACHE);
await waitNodes(23).catch(() => fail("replacing the text did not re-sync"));
await page.keyboard.press("ControlOrMeta+s");
await page.waitForTimeout(800);
const onDisk = await page.evaluate(async () => {
  const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("opscr-sample");
  return (await (await dir.getFileHandle("commerce.opscr.yaml")).getFile()).text();
});
await check(
  onDisk.includes("price-cache") && !onDisk.includes("name: exports"),
  "Ctrl/Cmd+S writes the edited file to the folder",
);
const sidecar = await page
  .evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("opscr-sample");
    return (await (await dir.getFileHandle("opscr.layout.json")).getFile()).text();
  })
  .catch(() => "");
const savedApi = JSON.parse(sidecar || "{}").elements?.["APIGateway/public-api"];
await check(
  Number.isFinite(savedApi?.x) && Number.isFinite(savedApi?.y),
  "saving writes the layout sidecar",
);

await setEditorText(SAMPLE["commerce.opscr.yaml"]);
await waitNodes(22).catch(() => fail("removing the Cache's manifest did not remove it"));
await check(true, "deleting a manifest removes its element");

// F2 on a manifest name renames it everywhere and keeps the canvas element.
const trackerBefore = await nodeBox("order-tracker");
const line = SAMPLE["commerce.opscr.yaml"].split("\n").indexOf("  name: order-tracker");
await page.locator(".monaco-editor .view-lines").first().click();
// To the first line: Ctrl+Home elsewhere, Cmd+Up on macOS.
await page.keyboard.press("ControlOrMeta+Home");
await page.keyboard.press("ControlOrMeta+ArrowUp");
await page.keyboard.press("Home");
for (let i = 0; i < line; i++) await page.keyboard.press("ArrowDown");
await page.keyboard.press("End");
await page.keyboard.press("F2");
// The rename box opens once the plugin resolved the name: wait for it to take focus.
await page
  .waitForFunction(() => !!document.activeElement?.closest(".rename-box"), null, { timeout: 5000 })
  .catch(() => fail("F2 did not open the rename box"));
await page.screenshot({ path: join(OUT, "4a-f2-open.png") });
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.type("order-relay");
await page.keyboard.press("Enter");
await page
  .locator(".react-flow__node", { hasText: "order-relay" })
  .first()
  .waitFor({ timeout: 10000 })
  .catch(() => fail("F2 rename did not reach the canvas"));
const trackerAfter = await nodeBox("order-relay");
await check(
  (await nodes()) === 22 &&
    Math.abs(trackerAfter.x - trackerBefore.x) < 2 &&
    Math.abs(trackerAfter.y - trackerBefore.y) < 2,
  "F2 renames the element in place on the canvas",
);
commerce = commerce.replace("name: order-tracker", "name: order-relay");
await page.screenshot({ path: join(OUT, "4a-f2-rename.png") });

await appendToEditor(
  "\n---\napiVersion: opscr.dev/v1\nkind: Database\nmetadata: { name: bad }\nspec: { provider: DynamoDB, description: x, inventedField: 1 }\n",
);
await page
  .waitForSelector(".monaco-editor .squiggly-error", { timeout: 10000 })
  .catch(() => fail("no error marker for an unknown field"));
await check(true, "an opscr error shows as a marker in the editor");
await page.screenshot({ path: join(OUT, "4-marker.png") });

// Canvas → YAML: edits on the canvas reach the text (read back from disk after saving).
const saveAndRead = async (name) => {
  const save = page.getByRole("button", { name: /^(Save|Salvar)$/ });
  if (await save.isEnabled()) await save.click();
  await page.waitForTimeout(500);
  return page.evaluate(async (file) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("opscr-sample");
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, name);
};
const waitFor = async (predicate, message) => {
  for (let i = 0; i < 20; i++) {
    if (await predicate()) return check(true, message);
    await page.waitForTimeout(500);
  }
  return fail(message);
};
const count = await nodes();
const cache = page.locator(".react-flow__node", { hasText: "cart-cache" }).first();
await cache.click();
await page.keyboard.press("Delete");
await waitNodes(count - 1).catch(() => fail("deleting cart-cache on the canvas did not remove it"));
await waitFor(
  async () =>
    !(await saveAndRead("commerce.opscr.yaml")).includes("cart-cache") &&
    !(await saveAndRead("relationships.opscr.yaml")).includes("cart-cache"),
  "a canvas delete removes the manifest and its edges",
);
await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
await page.keyboard.press("ControlOrMeta+z");
await waitNodes(count).catch(() => fail("undo did not bring cart-cache back"));
await waitFor(
  async () =>
    (await saveAndRead("commerce.opscr.yaml")).includes("name: cart-cache") &&
    (await saveAndRead("relationships.opscr.yaml")).includes("id: cart-cache"),
  "undo of the canvas delete restores the manifest and its edges",
);

await page.locator(".react-flow__node", { hasText: "orders-db" }).first().click();
const nameField = page.getByLabel(/^(Name|Nome)$/).first();
await nameField
  .waitFor({ timeout: 10000 })
  .catch(() => fail("no name field for the selected element"));
await nameField.fill("order-store");
// The panel commits the name on a debounce; closing it right away would drop the edit.
await page.waitForTimeout(1000);
await waitFor(async () => {
  const commerceText = await saveAndRead("commerce.opscr.yaml");
  const relationships = await saveAndRead("relationships.opscr.yaml");
  return (
    commerceText.includes("name: order-store") &&
    relationships.includes("id: order-store") &&
    !relationships.includes("orders-db")
  );
}, "a canvas rename renames the manifest and every edge end");
await check(
  (await saveAndRead("opscr.layout.json")).includes('"Database/order-store"'),
  "the rename re-keys the layout sidecar",
);
await check((await nodes()) === count, "the renamed element keeps its place (no remove/re-add)");
await page.screenshot({ path: join(OUT, "5-canvas-to-yaml.png") });

// The chat on the bound diagram answers with the opscr context and edits the YAML.
const prompts = [];
const CHAT_REPLY = [
  "Added a cache for search results.",
  "",
  "```yaml file=commerce.opscr.yaml",
  "apiVersion: opscr.dev/v1",
  "kind: Cache",
  "metadata:",
  "  name: search-cache",
  "spec:",
  "  provider: ElastiCache Redis",
  "  description: Search results",
  "```",
].join("\n");
await page.route("https://api.openai.com/**", async (route) => {
  prompts.push(route.request().postDataJSON().messages[0].content);
  const chunk = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  await route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream" },
    body: chunk(CHAT_REPLY.slice(0, 40)) + chunk(CHAT_REPLY.slice(40)) + "data: [DONE]\n\n",
  });
});
const chatCount = await nodes();
await page.getByRole("button", { name: /Open chat assistant|Abrir assistente de chat/ }).click();
const input = page.getByLabel(/Type your message|Digite sua mensagem/);
await input.waitFor({ timeout: 10000 }).catch(() => fail("the chat did not open"));
await input.fill("Add a Redis cache for search results");
await page.keyboard.press("ControlOrMeta+Enter");
await waitNodes(chatCount + 1).catch(() => fail("the chat's manifest did not reach the canvas"));
await check(
  prompts[0]?.includes("opscr editing assistant") &&
    prompts[0]?.includes('<file name="commerce.opscr.yaml">'),
  "the chat uses the opscr skill and the manifests as its context",
);
await waitFor(
  async () => (await saveAndRead("commerce.opscr.yaml")).includes("name: search-cache"),
  "the chat's change lands in the manifest (saved on demand)",
);
await check(
  (await page.getByText(/Added Cache\/search-cache|Adicionado: Cache\/search-cache/).count()) > 0,
  "the chat reply says what changed",
);
await page.screenshot({ path: join(OUT, "6-chat.png") });

await check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
server.kill();
