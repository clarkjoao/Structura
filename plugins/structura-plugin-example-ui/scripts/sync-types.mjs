#!/usr/bin/env node
/**
 * Sync the host plugin API contract into this plugin as the single source of truth.
 *
 * Copies, verbatim, from the host into `src/types/` here:
 *   - `src/features/plugins/plugin.types.ts` → `plugin.types.ts` (the API contract);
 *   - `src/features/plugins/structura-ui.d.ts` → `structura-ui.d.ts` (types of the
 *     `@structura/ui` import, API 1.18; mapped by this plugin's tsconfig `paths`).
 * Plugin code type-checks against the exact contract the host ships — no hand-maintained copy
 * to drift out of date.
 *
 *   node scripts/sync-types.mjs          # write the generated files
 *   node scripts/sync-types.mjs --check  # fail if any is stale (for CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const HOST = resolve(here, "../../../src/features/plugins");
const FILES = ["plugin.types.ts", "structura-ui.d.ts"];

const banner = (file) => `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host plugin API contract
 * (src/features/plugins/${file}), synced via \`npm run sync-types\`.
 * It is the single source of truth for plugin/host type compatibility; edit the host
 * file and re-run the sync instead of changing this file.
 */
`;

const isCheck = process.argv.includes("--check");
let stale = false;

for (const file of FILES) {
  const target = resolve(here, "../src/types", file);
  const generated = banner(file) + "\n" + readFileSync(resolve(HOST, file), "utf8");
  if (isCheck) {
    let current = "";
    try {
      current = readFileSync(target, "utf8");
    } catch {
      // missing target counts as stale
    }
    if (current !== generated) {
      console.error(`[sync-types] src/types/${file} is out of date. Run: npm run sync-types`);
      stale = true;
    }
  } else {
    writeFileSync(target, generated);
    console.log(`[sync-types] wrote src/types/${file}`);
  }
}

if (isCheck) {
  if (stale) process.exit(1);
  console.log("[sync-types] types are in sync.");
}
