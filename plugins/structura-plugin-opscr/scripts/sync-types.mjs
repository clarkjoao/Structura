#!/usr/bin/env node
/**
 * Sync the host plugin API contract into this plugin as the single source of truth.
 *
 * Copies `src/features/plugins/plugin.types.ts` from the host verbatim to
 * `src/types/plugin.types.ts` here, so plugin code type-checks against the exact contract
 * the host ships — no hand-maintained copy to drift out of date.
 *
 *   node scripts/sync-types.mjs          # write the generated file
 *   node scripts/sync-types.mjs --check  # fail if it is stale (for CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, "../../../src/features/plugins/plugin.types.ts");
const TARGET = resolve(here, "../src/types/plugin.types.ts");

const BANNER = `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host plugin API contract
 * (src/features/plugins/plugin.types.ts), synced via \`npm run sync-types\`.
 * It is the single source of truth for plugin/host type compatibility; edit the host
 * file and re-run the sync instead of changing this file.
 */
`;

const generated = BANNER + "\n" + readFileSync(SOURCE, "utf8");
const isCheck = process.argv.includes("--check");

if (isCheck) {
  let current = "";
  try {
    current = readFileSync(TARGET, "utf8");
  } catch {
    // missing target counts as stale
  }
  if (current !== generated) {
    console.error("[sync-types] src/types/plugin.types.ts is out of date. Run: npm run sync-types");
    process.exit(1);
  }
  console.log("[sync-types] types are in sync.");
} else {
  writeFileSync(TARGET, generated);
  console.log("[sync-types] wrote src/types/plugin.types.ts");
}
