/**
 * Regenerates the draw.io import fixtures used by the `src/lib/opscr-mapping` visual-layer tests.
 *
 * Runs opscr's draw.io import (`opscr/import-drawio`, no agent step) on the drawings below and
 * writes, per drawing, the compiled manifests (kind, name and spec — the shape the mapping reads),
 * `opscr.layout.json` and `opscr.visual.json` as one JSON file. Fails if a workspace does not
 * compile.
 *
 *   OPSCR_DIR=/path/to/opscr node scripts/opscr-drawio-fixture.mjs   # default ../opscr
 *
 * The opscr checkout must be built. Not part of CI (opscr is not on npm yet): the JSON is checked in.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const opscrDir = resolve(process.env.OPSCR_DIR ?? join(here, "../../opscr"));
const outDir = join(here, "../src/lib/opscr-mapping/__fixtures__");
const DRAWINGS = [
  join(opscrDir, "tests/import/corpus/vendor/aws/example-microservices.drawio"),
  process.env.SIMPLE_ARCH ??
    join(here, "../../test/drawio-diagrams/examples/aws-simple-architecture.drawio"),
];

const core = await import(pathToFileURL(join(opscrDir, "dist/core.js")).href);
const importer = await import(pathToFileURL(join(opscrDir, "dist/import/drawio/index.js")).href);

for (const drawing of DRAWINGS) {
  const source = basename(drawing);
  const files = await importer.importDrawio(readFileSync(drawing, "utf8"), { source });
  const yaml = files.filter((f) => f.path.endsWith(".opscr.yaml") && !f.path.includes("/"));
  const { workspace, result } = await core.compileSources({ files: yaml });
  if (result.hasErrors) {
    console.error(JSON.stringify(result.diagnostics, null, 2));
    process.exit(1);
  }
  const text = (name) => files.find((f) => f.path === name)?.content ?? null;
  const fixture = {
    source,
    manifests: workspace.manifests.map((m) => ({
      kind: m.kind,
      metadata: { name: m.metadata.name },
      spec: m.spec,
    })),
    layout: text("opscr.layout.json"),
    visual: text("opscr.visual.json"),
  };
  const out = join(outDir, `${source.replace(/\.drawio$/, "")}.import.json`);
  writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`wrote ${fixture.manifests.length} manifests to ${out}`);
}
