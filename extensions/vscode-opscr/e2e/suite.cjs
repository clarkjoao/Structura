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
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
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

  await until("the preview to draw the unsaved edit", async () => {
    const s = await status(folder);
    return s.components === first.components + 1 && s.rendered === s.components;
  });
  console.log("[e2e] webview drew the unsaved edit");

  const problems = await until("an opscr problem on the edited file", () =>
    vscode.languages
      .getDiagnostics(file)
      .find((d) => d.source === "opscr" && d.message.includes("inventedField")),
  );
  console.log(
    `[e2e] Problems panel: line ${problems.range.start.line + 1}: ${problems.message.split("\n")[0]}`,
  );

  await vscode.commands.executeCommand("workbench.action.files.revert");
  await until(
    "the problem to clear after revert",
    () => !vscode.languages.getDiagnostics(file).some((d) => d.message.includes("inventedField")),
  );
  console.log("[e2e] problem cleared");

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await editor(folder);
};

const editorStatus = async (folder) =>
  (await vscode.commands.executeCommand("opscr._editorStatus"))[folder];
const textOf = async (folder, name) =>
  (await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(folder, name)))).getText();

/** The diagram editor: YAML → diagram as you type, diagram → YAML as document edits, undo. */
async function editor(folder) {
  const commerce = vscode.Uri.file(path.join(folder, "commerce.opscr.yaml"));
  const doc = await vscode.workspace.openTextDocument(commerce);
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand("opscr.openEditor");
  const first = await until(
    "the diagram editor to draw the sample",
    async () => {
      const s = await editorStatus(folder);
      return s && s.ready && s.elements > 0 && s.components === s.elements ? s : undefined;
    },
    60000,
  );
  console.log(`[e2e] editor drew ${first.components} elements`);

  const cache =
    "\n---\napiVersion: opscr.dev/v1\nkind: Cache\nmetadata:\n  name: price-cache\nspec:\n  provider: ElastiCache Redis\n  description: Prices\n";
  const edit = new vscode.WorkspaceEdit();
  edit.insert(commerce, doc.lineAt(doc.lineCount - 1).range.end, cache);
  assert.ok(await vscode.workspace.applyEdit(edit));
  await until("the editor to draw the typed Cache", async () => {
    const s = await editorStatus(folder);
    return s.components === first.components + 1;
  });
  console.log("[e2e] typing a manifest adds it to the diagram");

  // A file written straight to disk (Claude Code, git): drawn once opscr validates it.
  const written = path.join(folder, "search.opscr.yaml");
  const search = (extra) =>
    `apiVersion: opscr.dev/v1\nkind: Application\nmetadata:\n  name: search-api\nspec:\n  provider: EKS\n  language: Go\n  description: Search\n${extra}`;
  const before = (await editorStatus(folder)).components;
  require("node:fs").writeFileSync(written, search("  inventedField: 1\n"));
  await until(
    "an invalid file to pause the diagram",
    async () => (await editorStatus(folder)).invalid > 0,
  );
  assert.equal(
    (await editorStatus(folder)).components,
    before,
    "the diagram keeps its last valid state",
  );
  console.log("[e2e] a file written with opscr errors leaves the diagram as it was");
  require("node:fs").writeFileSync(written, search(""));
  await until("the fixed file to be drawn", async () => {
    const s = await editorStatus(folder);
    return s.invalid === 0 && s.components === before + 1;
  });
  console.log("[e2e] once valid, the written file is drawn (laid out automatically)");

  const id = await vscode.commands.executeCommand("opscr._editorComponentId", folder, "orders-db");
  assert.ok(id, "orders-db is on the diagram");
  await vscode.commands.executeCommand("opscr._editorCanvasEdit", folder, {
    update: [{ id, name: "order-store" }],
  });
  await until("the rename on the diagram to reach both documents", async () => {
    const [c, r] = [
      await textOf(folder, "commerce.opscr.yaml"),
      await textOf(folder, "relationships.opscr.yaml"),
    ];
    return (
      c.includes("name: order-store") && r.includes("id: order-store") && !r.includes("orders-db")
    );
  });
  assert.ok(doc.isDirty, "diagram edits are left unsaved");
  console.log("[e2e] a rename on the diagram renames the manifest and every edge end (unsaved)");

  // VSCode's undo, in each file's editor: every file the diagram edited is its own undo step
  // there (the diagram's own undo reverts them all at once). Halfway — one file undone — the
  // edges name an element that is gone, opscr reports it and the diagram waits.
  for (const name of ["commerce.opscr.yaml", "relationships.opscr.yaml"]) {
    await vscode.window.showTextDocument(vscode.Uri.file(path.join(folder, name)));
    await sleep(500);
    await vscode.commands.executeCommand("undo");
  }
  await until(
    "undo to bring the old name back to the text and the diagram",
    async () =>
      (await textOf(folder, "commerce.opscr.yaml")).includes("name: orders-db") &&
      (await textOf(folder, "relationships.opscr.yaml")).includes("id: orders-db") &&
      (await vscode.commands.executeCommand("opscr._editorComponentId", folder, "orders-db")),
  );
  console.log("[e2e] VSCode undo in both files reverts the rename, and the diagram follows");
}
