// Runs inside VSCode (see run.mjs). Plain CommonJS: no test framework needed.
const vscode = require("vscode");
const assert = require("node:assert/strict");
const path = require("node:path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(what, check, timeout = 90000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) {
      const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
      throw new Error(`timed out waiting for ${what}: ${JSON.stringify(await status(folder))}`);
    }
    await sleep(200);
  }
}
const status = async (folder) =>
  (await vscode.commands.executeCommand("opscr._previewStatus"))[folder];

exports.run = async function run() {
  const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const file = vscode.Uri.file(path.join(folder, "relationships.opscr.yaml"));
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand("opscr.openPreview");

  const first = await until("the webview to load and draw", async () => {
    const s = await status(folder);
    return s && s.ready && s.components > 0 && s.rendered === s.components ? s : undefined;
  });
  console.log(`[e2e] webview drew ${first.rendered} of ${first.components} elements`);
  const probe = () => vscode.commands.executeCommand("opscr._previewProbe", folder);
  const start = await probe();
  await vscode.commands.executeCommand("opscr.searchPreview");
  await until("the search to open in the preview", async () => (await probe()).searchOpen);
  console.log("[e2e] find in preview opens the element search");

  const cache = [
    "",
    "---",
    "apiVersion: opscr.dev/v1",
    "kind: Cache",
    "metadata: { name: price-cache }",
    "spec: { provider: ElastiCache Redis, description: Prices, inventedField: 1 }",
    "",
  ].join("\n");
  const edit = new vscode.WorkspaceEdit();
  edit.insert(file, doc.lineAt(doc.lineCount - 1).range.end, cache);
  assert.ok(await vscode.workspace.applyEdit(edit));
  assert.ok(doc.isDirty, "the edit is not saved");

  // opscr reports an error: the preview keeps its last valid picture until it is fixed.
  await until("the preview to hold its picture while opscr reports errors", async () => {
    const s = await status(folder);
    return s.blocked > 0;
  });
  assert.equal((await status(folder)).components, first.components);
  await until("the preview to say it is not updated", async () => (await probe()).blocked);
  console.log("[e2e] an edit with opscr errors is not drawn; the last valid picture stays");

  const problems = await until("an opscr problem on the edited file", () =>
    vscode.languages
      .getDiagnostics(file)
      .find((d) => d.source === "opscr" && d.message.includes("inventedField")),
  );
  console.log(
    `[e2e] Problems panel: line ${problems.range.start.line + 1}: ${problems.message.split("\n")[0]}`,
  );

  // The search took the focus into the preview: back to the file before reverting it.
  // In the first column: the active one is the preview's now, and covering it would hide it.
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
  await sleep(500);
  await vscode.commands.executeCommand("workbench.action.files.revert");
  await until(
    "the problem to clear after revert",
    () => !vscode.languages.getDiagnostics(file).some((d) => d.message.includes("inventedField")),
  );
  console.log("[e2e] problem cleared");

  // A valid file written straight to disk (Claude Code, git) is drawn, laid out automatically.
  require("node:fs").writeFileSync(
    path.join(folder, "search.opscr.yaml"),
    "apiVersion: opscr.dev/v1\nkind: Application\nmetadata:\n  name: search-api\nspec:\n  provider: EKS\n  language: Go\n  description: Search\n",
  );
  await until("the file written to disk to be drawn", async () => {
    const s = await status(folder);
    // Not `rendered === components`: the preview zooms to the new element, and React Flow only
    // puts on-screen nodes in the page.
    return s.blocked === 0 && s.components === first.components + 1 && s.rendered > 0;
  });
  console.log("[e2e] a valid file written to disk is drawn");
  await until("the preview to zoom to the new element", async () => {
    const now = await probe();
    return now.viewport && now.viewport !== start.viewport && now.viewport.endsWith("scale(1)");
  });
  console.log("[e2e] the preview zooms to the element the file added");

  // The workspace is the folder, subfolders included: a manifest two levels down is drawn too,
  // and opening the preview from it finds the same workspace (the config is at the root).
  const fs = require("node:fs");
  const nestedDir = path.join(folder, "extra", "deeper");
  fs.mkdirSync(nestedDir, { recursive: true });
  const nested = path.join(nestedDir, "billing.opscr.yaml");
  fs.writeFileSync(
    nested,
    "apiVersion: opscr.dev/v1\nkind: Application\nmetadata:\n  name: billing-api\nspec:\n  provider: EKS\n  language: Java\n  description: Billing\n",
  );
  await until("a manifest in a subfolder to be drawn", async () => {
    const s = await status(folder);
    return s.blocked === 0 && s.components === first.components + 2;
  });
  console.log("[e2e] a manifest in a subfolder is drawn");
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(nested)), vscode.ViewColumn.One);
  await vscode.commands.executeCommand("opscr.openPreview");
  await sleep(500);
  const all = await vscode.commands.executeCommand("opscr._previewStatus");
  assert.deepEqual(Object.keys(all), [folder], "the nested file opens the workspace's preview, not its own");
  console.log("[e2e] a file in a subfolder opens the workspace's preview");

  // With no opscr.config.yaml at all, the workspace is found from the open file: a view in
  // `views/` names elements in `model/`, so its own folder is not enough and the one above is.
  const os = require("node:os");
  const { execFileSync } = require("node:child_process");
  const opscrRoot = path.dirname(require.resolve("opscr/package.json"));
  const git = (...args) => execFileSync("git", ["-C", opscrRoot, ...args], { encoding: "utf8" });
  const solo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "opscr-solo-")));
  for (const sub of ["model", "views"]) fs.mkdirSync(path.join(solo, sub));
  for (const p of git("ls-tree", "--name-only", "HEAD", "examples/web-app-aws/").split("\n").filter((n) => n.endsWith(".opscr.yaml"))) {
    const name = path.basename(p);
    const dir = /^shop-(context|containers|production)|^orders-api-components/.test(name) ? "views" : "model";
    fs.writeFileSync(path.join(solo, dir, name), git("show", `HEAD:${p}`));
  }
  await vscode.window.showTextDocument(
    await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(solo, "views", "shop-context.opscr.yaml"))),
    vscode.ViewColumn.One,
  );
  await vscode.commands.executeCommand("opscr.openPreview");
  await until("the preview of a solution with no config to draw its model", async () => {
    const s = (await vscode.commands.executeCommand("opscr._previewStatus"))[solo];
    return s && s.ready && s.blocked === 0 && s.components >= 9;
  });
  console.log("[e2e] a view with no config finds its solution from the file alone");

  // The Views of that solution: pick one, then follow a box that opens another (a double-click in
  // the preview, posed as the webview's message).
  const soloStatus = async () => (await vscode.commands.executeCommand("opscr._previewStatus"))[solo];
  assert.equal((await soloStatus()).view, null);
  assert.equal((await soloStatus()).views.length, 4);
  await vscode.commands.executeCommand("opscr._previewView", solo, "shop-containers");
  await until("the container view to be drawn", async () => {
    const s = await soloStatus();
    return s.view === "shop-containers" && s.blocked === 0 && s.components === 10;
  });
  console.log("[e2e] picking a view draws it (10 elements)");
  await vscode.commands.executeCommand("opscr._previewMessage", solo, {
    type: "STRUCTURA_OPEN",
    element: { kind: "component", key: "Application/orders-api" },
  });
  await until("the component view to open from its box", async () => {
    const s = await soloStatus();
    return s.view === "orders-api-components" && s.components === 8;
  });
  console.log("[e2e] a double-click on a box opens the view it links to");
  // A box that links nowhere does nothing.
  await vscode.commands.executeCommand("opscr._previewMessage", solo, {
    type: "STRUCTURA_OPEN",
    element: { kind: "component", key: "Database/orders-db" },
  });
  await sleep(500);
  assert.equal((await soloStatus()).view, "orders-api-components");
  await vscode.commands.executeCommand("opscr._previewView", solo, undefined);
  await until("the whole workspace to come back", async () => {
    const s = await soloStatus();
    return s.view === null && s.components === 9;
  });
  console.log("[e2e] the whole workspace comes back");

  // A click on an element opens the YAML that writes it (posed as the webview's message: a test
  // cannot click inside the webview).
  await vscode.commands.executeCommand("opscr._previewMessage", folder, {
    type: "STRUCTURA_REVEAL",
    element: { kind: "component", key: "Database/orders-db" },
  });
  const editor = await until("the clicked element's YAML to open at its manifest", () => {
    const e = vscode.window.activeTextEditor;
    if (!e || !e.document.uri.fsPath.endsWith("commerce.opscr.yaml")) return undefined;
    const line = e.selection.active.line;
    const near = Array.from({ length: 4 }, (_, i) =>
      line + i < e.document.lineCount ? e.document.lineAt(line + i).text : "",
    );
    return near.some((t) => t.includes("orders-db")) ? e : undefined;
  });
  console.log(
    `[e2e] clicking an element opens commerce.opscr.yaml:${editor.selection.active.line + 1}`,
  );

  // The cursor in another manifest lights that element in the preview.
  const api = editor.document
    .getText()
    .split("\n")
    .findIndex((t) => t.includes("name: orders-api"));
  editor.selection = new vscode.Selection(api, 0, api, 0);
  await until("the element under the cursor to be lit in the preview", async () =>
    (await probe()).selected?.includes("Application/orders-api"),
  );
  console.log("[e2e] the cursor's element is lit in the preview");
};
