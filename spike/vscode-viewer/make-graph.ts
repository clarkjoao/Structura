// SPIKE: what the VSCode extension host would do on every save — YAML → importer result.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { importOpscr } from "../../plugins/structura-plugin-opscr/src/import-opscr";

const dir = process.argv[2]!;
const extra = process.argv[3] ?? "";
const yaml =
  readdirSync(dir)
    .filter((f) => f.endsWith(".opscr.yaml"))
    .sort()
    .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
    .join("\n---\n") + extra;
const t0 = performance.now();
const result = await importOpscr(yaml, {
  existingComponents: {},
  existingConnections: {},
  anchor: { x: 40, y: 40 },
});
console.error(
  `yaml → graph: ${(performance.now() - t0).toFixed(0)} ms, ${result.components.length} components`,
);
writeFileSync(process.argv[4] ?? "graph.json", JSON.stringify(result));
