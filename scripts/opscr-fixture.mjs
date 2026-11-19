/**
 * Regenerates the opscr sample fixture used by `src/lib/opscr-mapping` tests.
 *
 * Compiles `examples/sample` of an opscr checkout with `opscr/core` (the same engine
 * as `opscr compile`) and writes its manifests — kind, name and spec only, the shape
 * the mapping reads — as JSON. It fails if the sample does not compile clean, so the
 * fixture is always a valid workspace.
 *
 *   node scripts/opscr-fixture.mjs                 # opscr checkout at ../asc
 *   OPSCR_DIR=/path/to/opscr node scripts/opscr-fixture.mjs
 *
 * The opscr checkout must be built (`npm run build` there). Not part of CI: opscr is
 * not on npm yet, so the generated JSON is checked in.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const opscrDir = resolve(process.env.OPSCR_DIR ?? join(here, "../../asc"));
const out = join(here, "../src/lib/opscr-mapping/__fixtures__/sample.workspace.json");

const core = await import(pathToFileURL(join(opscrDir, "dist/core.js")).href);
const sampleDir = join(opscrDir, "examples/sample");
const read = (name) => ({ path: name, content: readFileSync(join(sampleDir, name), "utf8") });

const files = readdirSync(sampleDir)
  .filter((f) => /\.opscr\.ya?ml$/.test(f))
  .sort()
  .map(read);
const { workspace, result } = await core.compileSources({
  files,
  config: read("opscr.config.yaml"),
});

if (result.hasErrors || result.hasWarnings) {
  console.error(JSON.stringify(result.diagnostics, null, 2));
  process.exit(1);
}

const manifests = workspace.manifests.map((m) => ({
  kind: m.kind,
  metadata: { name: m.metadata.name },
  spec: m.spec,
}));
writeFileSync(out, JSON.stringify({ manifests }, null, 2) + "\n");
console.log(`wrote ${manifests.length} manifests to ${out}`);
