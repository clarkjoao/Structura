#!/usr/bin/env node
/**
 * Sync the framework-agnostic opscr mapping into this plugin as the single source
 * of truth for how an opscr workspace is drawn.
 *
 * Copies every file from the host's `src/lib/opscr-mapping` (except tests) into
 * `src/generated/opscr-mapping` here, verbatim + a DO-NOT-EDIT banner. The plugin
 * is a separate Vite IIFE bundle with no `@` alias, so it cannot import the host
 * core directly — this mirrors the `sync-types` mechanism for runtime code.
 *
 *   node scripts/sync-shared.mjs          # write the generated files
 *   node scripts/sync-shared.mjs --check  # fail if any is stale (for CI)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(here, "../../../src/lib/opscr-mapping");
const TARGET_DIR = resolve(here, "../src/generated/opscr-mapping");

const BANNER = `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host opscr mapping (src/lib/opscr-mapping), synced via
 * \`npm run sync-shared\`. It is the single source of truth for opscr
 * projection shared by the app and this plugin; edit the host files and re-sync.
 */
`;

const sourceFiles = readdirSync(SOURCE_DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .sort();

function generate(file) {
  return BANNER + "\n" + readFileSync(join(SOURCE_DIR, file), "utf8");
}

const isCheck = process.argv.includes("--check");

if (isCheck) {
  let stale = false;
  const existing = existsSync(TARGET_DIR)
    ? readdirSync(TARGET_DIR).filter((f) => f.endsWith(".ts"))
    : [];
  const expected = new Set(sourceFiles);
  for (const f of existing) {
    if (!expected.has(f)) {
      stale = true;
      console.error(`[sync-shared] stray generated file: ${f}`);
    }
  }
  for (const f of sourceFiles) {
    let current = "";
    try {
      current = readFileSync(join(TARGET_DIR, f), "utf8");
    } catch {
      // missing counts as stale
    }
    if (current !== generate(f)) {
      stale = true;
      console.error(`[sync-shared] out of date: ${f}`);
    }
  }
  if (stale) {
    console.error("[sync-shared] generated opscr mapping is stale. Run: npm run sync-shared");
    process.exit(1);
  }
  console.log("[sync-shared] generated opscr mapping is in sync.");
} else {
  rmSync(TARGET_DIR, { recursive: true, force: true });
  mkdirSync(TARGET_DIR, { recursive: true });
  for (const f of sourceFiles) {
    writeFileSync(join(TARGET_DIR, f), generate(f));
  }
  console.log(`[sync-shared] wrote ${sourceFiles.length} files to src/generated/opscr-mapping`);
}
