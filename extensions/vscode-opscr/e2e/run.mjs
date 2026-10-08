#!/usr/bin/env node
/**
 * End-to-end test in a real VSCode: opens a copy of the opscr sample, runs the preview,
 * makes an edit with an opscr error (not drawn; reported in the Problems panel), reverts it,
 * and writes a valid file straight to disk, as Claude Code would (drawn). Uses an isolated user-data and extensions
 * directory, so the user's VSCode settings and extensions are untouched.
 *
 *   npm run build && node e2e/run.mjs
 *   VSCODE_PATH=/path/to/Code node e2e/run.mjs   # another VSCode binary
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// The sample as committed in the opscr checkout: local edits there must not change the test.
const opscrRoot = dirname(require.resolve("opscr/package.json"));
const git = (...args) => execFileSync("git", ["-C", opscrRoot, ...args], { encoding: "utf8" });
const workspace = mkdtempSync(join(tmpdir(), "opscr-e2e-"));
for (const path of git("ls-tree", "--name-only", "HEAD", "examples/sample/")
  .split("\n")
  .filter(Boolean)) {
  writeFileSync(join(workspace, path.split("/").pop()), git("show", `HEAD:${path}`));
}
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
