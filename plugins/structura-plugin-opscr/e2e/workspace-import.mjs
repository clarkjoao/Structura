#!/usr/bin/env node
/**
 * End-to-end check of the opscr workspace importer: from the workspace home, Import → "opscr
 * folder (product)" picks the web-shop-product example and sets it up in one go — a workspace
 * folder named after the product, its diagram bound to the folder and opened with the pane, a
 * diagram per View in the same folder, the initiative as a Version. Picking the folder again
 * opens the same diagram.
 *
 *   (in the repo root) npm run build:plugins -- structura-plugin-opscr
 *   (here)             node e2e/workspace-import.mjs
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

const PORT = 4182;

const seed = JSON.stringify({
  state: {
    diagrams: {},
    folders: {},
    userTemplates: {},
    services: {},
    activeDiagramId: null,
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
  await page.screenshot({ path: join(OUT, "workspace-import-failure.png") }).catch(() => {});
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

const settle = () => page.waitForTimeout(2500);
const store = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("structura_diagram-store")).state);
const importFolder = async () => {
  await page.goto(`http://localhost:${PORT}/workspace`);
  await page.getByRole("button", { name: /^(Import|Importar)$/ }).click();
  await page.screenshot({ path: join(OUT, "workspace-import-0-modal.png") });
  await page
    .getByRole("button", { name: /opscr folder \(product\)|Pasta opscr \(produto\)/ })
    .click();
  await page.waitForURL(/\/model\//, { timeout: 30000 });
  await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
};

await importFolder();
await page
  .getByRole("tab", { name: /^(Initiatives|Iniciativas)/ })
  .waitFor({ timeout: 30000 })
  .catch(() => fail("the pane did not open the folder on its own"));
await settle();
await settle();
await page.screenshot({ path: join(OUT, "workspace-import-1-opened.png") });

const state = await store();
const folders = Object.values(state.folders);
const product = folders.find((f) => f.name === "Web shop");
await check(
  product !== undefined,
  `a workspace folder named after the product (${folders.map((f) => f.name)})`,
);
const main = Object.values(state.diagrams).find((d) => d.name === "Web shop");
await check(
  main?.folderId === product.id && page.url().endsWith(`/model/${main.id}`),
  "the product's diagram is in it, and open",
);
await check(
  Object.keys(main.snapshot.components).length >= 8,
  `the diagram draws the folder (${Object.keys(main.snapshot.components).length} elements)`,
);
const inFolder = Object.values(state.diagrams).filter((d) => d.folderId === product.id);
await check(
  inFolder.length === 5,
  `the View diagrams are made beside it (${inFolder.map((d) => d.name).join(", ")})`,
);
await check(
  Object.values(main.versions ?? {}).some((v) => v.key === "order-events"),
  "the initiative is a Version of the diagram",
);

await importFolder();
await settle();
const again = await store();
await check(
  Object.keys(again.diagrams).length === Object.keys(state.diagrams).length &&
    Object.keys(again.folders).length === Object.keys(state.folders).length &&
    page.url().endsWith(`/model/${main.id}`),
  "picking the same folder again opens the diagram it made",
);
await page.screenshot({ path: join(OUT, "workspace-import-2-again.png") });

await check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
server.kill();
