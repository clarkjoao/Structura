#!/usr/bin/env node
/**
 * Sync the opscr plugin's framework-agnostic projection library into this extension, as the
 * single source of truth for how an opscr workspace is drawn.
 *
 * Copies every non-test file of `plugins/structura-plugin-opscr/src/opscr-mapping` into
 * `src/generated/<name>/` here, verbatim + a DO-NOT-EDIT banner. The extension is a separate
 * esbuild bundle with no `@` alias, so it cannot import the plugin directly — the same mechanism
 * the LeanIX plugin uses for `export-core`. Layout is not copied: the extension lays out with
 * Structura's placement through the preview's webview (`STRUCTURA_PLACE`, `src/webview-placer.ts`).
 *
 *   node scripts/sync-shared.mjs          # write the generated files
 *   node scripts/sync-shared.mjs --check  # fail if any is stale
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LIBS = ["opscr-mapping"];
const sourceDir = (lib) => resolve(here, "../../../plugins/structura-plugin-opscr/src", lib);
const targetDir = (lib) => resolve(here, "../src/generated", lib);

const banner = (lib) => `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of plugins/structura-plugin-opscr/src/${lib}, synced via \`npm run sync-shared\`.
 * Edit the plugin's files and re-sync instead of changing this file.
 */
`;

const sourceFiles = (lib) =>
  readdirSync(sourceDir(lib))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();
const generate = (lib, file) =>
  banner(lib) + "\n" + readFileSync(join(sourceDir(lib), file), "utf8");

if (process.argv.includes("--check")) {
  let stale = false;
  for (const lib of LIBS) {
    const expected = new Set(sourceFiles(lib));
    const existing = existsSync(targetDir(lib))
      ? readdirSync(targetDir(lib)).filter((f) => f.endsWith(".ts"))
      : [];
    for (const f of existing) {
      if (!expected.has(f)) {
        stale = true;
        console.error(`[sync-shared] stray generated file: ${lib}/${f}`);
      }
    }
    for (const f of expected) {
      const path = join(targetDir(lib), f);
      if (!existsSync(path) || readFileSync(path, "utf8") !== generate(lib, f)) {
        stale = true;
        console.error(`[sync-shared] out of date: ${lib}/${f}`);
      }
    }
  }
  if (stale) {
    console.error("[sync-shared] generated opscr libraries are stale. Run: npm run sync-shared");
    process.exit(1);
  }
  console.log("[sync-shared] generated opscr libraries are in sync.");
} else {
  for (const lib of LIBS) {
    rmSync(targetDir(lib), { recursive: true, force: true });
    mkdirSync(targetDir(lib), { recursive: true });
    for (const f of sourceFiles(lib)) writeFileSync(join(targetDir(lib), f), generate(lib, f));
    console.log(`[sync-shared] wrote ${sourceFiles(lib).length} files to src/generated/${lib}`);
  }
}
