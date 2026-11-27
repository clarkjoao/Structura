import { describe, expect, it } from "vitest";
import { withoutBroken } from "./broken";
import type { LocatedManifestInput } from "./source-index";

const manifest = (kind: string, name: string, line: number, edges = 0): LocatedManifestInput => ({
  kind,
  metadata: { name },
  spec: edges > 0 ? { edges: Array.from({ length: edges }, () => ({})) } : {},
  sourceFile: "infra.opscr.yaml",
  line,
  edgeLines: new Map(Array.from({ length: edges }, (_, i) => [i, line + 5 + i] as const)),
});

describe("withoutBroken", () => {
  const app = manifest("Application", "api", 1);
  const topic = manifest("Topic", "events", 10);
  const edges = manifest("Relationship", "rels", 20, 2);
  const all = [app, topic, edges];

  it("leaves out the element an error line falls in, and keeps the rest", () => {
    const result = withoutBroken(all, [
      { severity: "error", file: "infra.opscr.yaml", line: 14 },
      { severity: "warning", file: "infra.opscr.yaml", line: 3 },
    ]);
    expect(result.manifests).toEqual([app, edges]);
    expect(result.broken).toEqual(["Topic/events"]);
  });

  it("keeps a Relationship whatever its errors: a bad edge must not take the others", () => {
    const result = withoutBroken(all, [{ severity: "error", file: "infra.opscr.yaml", line: 26 }]);
    expect(result.manifests).toEqual(all);
    expect(result.broken).toEqual([]);
  });

  it("ignores errors that name no line, or another file", () => {
    const result = withoutBroken(all, [
      { severity: "error" },
      { severity: "error", file: "other.opscr.yaml", line: 12 },
    ]);
    expect(result.manifests).toEqual(all);
  });
});
