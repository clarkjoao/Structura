// Runs inside VSCode (see run.mjs). Plain CommonJS: no test framework needed.
const vscode = require("vscode");
const assert = require("node:assert/strict");
const path = require("node:path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(what, check, timeout = 30000) {
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
};
