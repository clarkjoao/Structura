#!/usr/bin/env node
/**
 * End-to-end test in a real VSCode: opens a copy of the opscr sample, runs the preview,
 * edits a file without saving, and checks that the webview loaded, followed the edit and that
 * an opscr error reached the Problems panel. Uses an isolated user-data and extensions
 * directory, so the user's VSCode settings and extensions are untouched.
 *
 *   npm run build && node e2e/run.mjs
 *   VSCODE_PATH=/path/to/Code node e2e/run.mjs   # another VSCode binary
 */
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sample = join(dirname(require.resolve("opscr/package.json")), "examples/sample");
const workspace = mkdtempSync(join(tmpdir(), "opscr-e2e-"));
for (const f of readdirSync(sample)) cpSync(join(sample, f), join(workspace, f));
const profile = mkdtempSync(join(tmpdir(), "opscr-e2e-profile-"));

await runTests({
  vscodeExecutablePath:
    process.env.VSCODE_PATH ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code",
  extensionDevelopmentPath: resolve(here, ".."),
  extensionTestsPath: resolve(here, "suite.cjs"),
  launchArgs: [
    workspace,
    "--disable-extensions",
    `--user-data-dir=${join(profile, "user")}`,
    `--extensions-dir=${join(profile, "extensions")}`,
    "--disable-workspace-trust",
  ],
});
