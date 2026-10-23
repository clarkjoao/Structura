import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A node's handle sides come from one place, `node-types/handle-sides.ts`, by
 * the diagram's reading direction (ADR-0013). A renderer that names a side
 * itself is one that will keep reading left-to-right when the diagram does not,
 * so none may: every node file asks `useHandleSides()` instead.
 */

const NODES = __dirname;
const SIDE = /\bPosition\.(Left|Right|Top|Bottom)\b/;
const ALLOWED = new Set([path.join(NODES, "node-types", "handle-sides.ts")]);

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

describe("node handle sides", () => {
  it("are named only in handle-sides.ts", () => {
    const offenders = sources(NODES)
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => SIDE.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(NODES, file));
    expect(offenders).toEqual([]);
  });
});
