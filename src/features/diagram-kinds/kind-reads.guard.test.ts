import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A diagram's kind is read through `resolveKindPolicy` (D3), never by testing
 * `diagram.kind` / `kindMode` where a feature decides what to do. Only the
 * places that carry or sanitize the fields, and the kind modules themselves,
 * may touch them.
 */

const SRC = path.resolve(__dirname, "../..");
/**
 * `.kindMode` is only ever a diagram's; `.kind` is too common (icon sources,
 * condition kinds, …), so only a receiver named like a diagram counts.
 */
const READ = /\.kindMode\b|\b(diagram|activeDiagram|currentDiagram)\??\.kind\b(?!Data)/;

const ALLOWED = [
  "features/diagram-kinds/",
  "features/diagram/model/diagram-kind.ts",
  "features/diagram/store/slices/kind.slice.ts",
  "features/diagram/store/slices/history.slice.ts",
  "features/diagram/store/slices/diagram.slice.ts",
  "features/collaboration/sync/diagramState.ts",
  "infrastructure/persistence/workspace-folder-sync-equality.ts",
  "lib/export-service/normalize-imported-diagram.ts",
  "features/plugins/plugin-api.ts",
  "features/plugins/snapshots.ts",
  "features/plugins/use-plugin-contributions.ts",
].map((p) => path.join(SRC, p));

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

describe("diagram kind reads", () => {
  it("go through the policy resolver outside the kind modules", () => {
    const offenders = sources(SRC)
      .filter((file) => !ALLOWED.some((allowed) => file.startsWith(allowed)))
      .filter((file) => {
        const code = fs
          .readFileSync(file, "utf8")
          .split("\n")
          .filter((line) => !/^\s*(\*|\/\/)/.test(line));
        return code.some((line) => READ.test(line));
      })
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
