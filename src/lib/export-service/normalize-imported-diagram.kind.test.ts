import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import { hashElement } from "@/features/diagram/utils/element-hash";
import { normalizeImportedDiagram } from "./normalize-imported-diagram";

function imported(extra: Record<string, unknown>): Diagram {
  return {
    id: "d",
    name: "d",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...extra,
  } as Diagram;
}

describe("normalizeImportedDiagram — diagram kind", () => {
  it("adds no kind keys to a freehand diagram, so it hashes as before", () => {
    const before = imported({});
    const out = normalizeImportedDiagram(before);
    expect("kind" in out || "kindMode" in out || "kindData" in out).toBe(false);
    expect(hashElement({ ...out, snapshot: before.snapshot })).toBe(hashElement(before));
  });

  it("keeps a kind whose plugin is not installed, with its mode and data", () => {
    const out = normalizeImportedDiagram(
      imported({ kind: "acme-vsm:value-stream", kindMode: "freehand", kindData: { lanes: 3 } }),
    );
    expect(out.kind).toBe("acme-vsm:value-stream");
    expect(out.kindMode).toBe("freehand");
    expect(out.kindData).toEqual({ lanes: 3 });
  });

  it("drops a malformed kind and still loads the diagram", () => {
    const out = normalizeImportedDiagram(imported({ kind: 42, kindData: "x", name: "kept" }));
    expect("kind" in out).toBe(false);
    expect("kindData" in out).toBe(false);
    expect(out.name).toBe("kept");
  });
});
