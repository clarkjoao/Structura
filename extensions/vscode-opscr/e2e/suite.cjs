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
  await vscode.commands.executeCommand("opscr.searchPreview");
  console.log("[e2e] find in preview runs");

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
  await vscode.window.showTextDocument(doc);
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
};
