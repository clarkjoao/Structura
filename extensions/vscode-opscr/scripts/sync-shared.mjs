#!/usr/bin/env node
/**
 * Sync the host's framework-agnostic opscr libraries into this extension, as the single source
 * of truth for how an opscr workspace is drawn and laid out — and the opscr plugin's binding
 * engine (`plugins/structura-plugin-opscr/src/engine`, its projector and plugin types) into
 * `src/generated/opscr-engine/`, with its imports pointed at the copies here.
 *
 * Copies every non-test file of `src/lib/opscr-mapping` and `src/lib/opscr-layout` from the
 * host into `src/generated/<name>/` here, verbatim + a DO-NOT-EDIT banner. The extension is a
 * separate esbuild bundle with no `@` alias, so it cannot import the host directly — the
 * same mechanism the LeanIX plugin uses for `export-core`. The folders stay siblings, so the
 * layout's `../opscr-mapping` import resolves the same way here.
 *
 *   node scripts/sync-shared.mjs          # write the generated files
 *   node scripts/sync-shared.mjs --check  # fail if any is stale
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = resolve(here, "../../../plugins/structura-plugin-opscr/src");
const tsSources = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();

/** Each generated folder: its files (target name → source path) and the import rewrites. */
const LIBS = {
  "opscr-mapping": {
    origin: "the host's src/lib/opscr-mapping",
    dir: resolve(here, "../../../src/lib/opscr-mapping"),
  },
  "opscr-layout": {
    origin: "the host's src/lib/opscr-layout",
    dir: resolve(here, "../../../src/lib/opscr-layout"),
  },
  "opscr-engine": {
    origin: "the opscr plugin's src/engine (+ project.ts, plugin types)",
    files: () => ({
      ...Object.fromEntries(
        tsSources(join(plugin, "engine")).map((f) => [f, join(plugin, "engine", f)]),
      ),
      "project.ts": join(plugin, "project.ts"),
      "plugin-types.ts": join(plugin, "types/plugin.types.ts"),
    }),
    rewrite: (text) =>
      text
        .replaceAll('"../generated/opscr-mapping"', '"../opscr-mapping"')
        .replaceAll('"./generated/opscr-mapping"', '"../opscr-mapping"')
        .replaceAll('"./generated/opscr-layout"', '"../opscr-layout"')
        .replaceAll('"../types/plugin.types"', '"./plugin-types"')
        .replaceAll('"./engine/engine"', '"./engine"'),
  },
};
const libFiles = (lib) => {
  const spec = LIBS[lib];
  return spec.files
    ? spec.files()
    : Object.fromEntries(tsSources(spec.dir).map((f) => [f, join(spec.dir, f)]));
};
const targetDir = (lib) => resolve(here, "../src/generated", lib);

const banner = (lib) => `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Copy of ${LIBS[lib].origin}, synced via \`npm run sync-shared\`.
 * Edit the source files and re-sync instead of changing this file.
 */
`;

const sourceFiles = (lib) => Object.keys(libFiles(lib)).sort();
const generate = (lib, file) =>
  banner(lib) + "\n" + (LIBS[lib].rewrite ?? ((t) => t))(readFileSync(libFiles(lib)[file], "utf8"));

if (process.argv.includes("--check")) {
  let stale = false;
  for (const lib of Object.keys(LIBS)) {
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
  for (const lib of Object.keys(LIBS)) {
    rmSync(targetDir(lib), { recursive: true, force: true });
    mkdirSync(targetDir(lib), { recursive: true });
    for (const f of sourceFiles(lib)) writeFileSync(join(targetDir(lib), f), generate(lib, f));
    console.log(`[sync-shared] wrote ${sourceFiles(lib).length} files to src/generated/${lib}`);
  }
}
