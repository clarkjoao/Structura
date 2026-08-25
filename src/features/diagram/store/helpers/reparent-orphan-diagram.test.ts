import { describe, expect, it } from "vitest";
import type { Diagram, Folder } from "../../model/diagram.types";
import { reparentOrphanDiagram, reparentOrphanDiagrams } from "./reparent-orphan-diagram";

function makeDiagram(id: string, folderId?: string | null): Diagram {
  return {
    id,
    name: id,
    level: "context",
    createdAt: 1,
    updatedAt: 1,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...(folderId === undefined ? {} : { folderId }),
  };
}

const FOLDERS: Record<string, Folder> = {
  known: { id: "known", name: "Known", parentId: null },
};

describe("reparentOrphanDiagram", () => {
  it("clears a folderId that does not resolve", () => {
    const result = reparentOrphanDiagram(makeDiagram("d1", "missing"), FOLDERS);

    expect(result.folderId).toBeUndefined();
    expect("folderId" in result).toBe(false);
  });

  it("preserves a folderId that resolves, without copying", () => {
    const diagram = makeDiagram("d1", "known");

    expect(reparentOrphanDiagram(diagram, FOLDERS)).toBe(diagram);
  });

  it("leaves a diagram without a folderId untouched", () => {
    const diagram = makeDiagram("d1");

    expect(reparentOrphanDiagram(diagram, FOLDERS)).toBe(diagram);
  });

  it("treats an explicit null folderId as already at the root", () => {
    const diagram = makeDiagram("d1", null);

    expect(reparentOrphanDiagram(diagram, FOLDERS)).toBe(diagram);
  });

  it("clears every folderId when the workspace has no folders", () => {
    const result = reparentOrphanDiagram(makeDiagram("d1", "known"), {});

    expect(result.folderId).toBeUndefined();
  });
});

describe("reparentOrphanDiagrams", () => {
  it("repairs only the orphans and keeps the rest", () => {
    const diagrams = {
      orphan: makeDiagram("orphan", "missing"),
      filed: makeDiagram("filed", "known"),
      root: makeDiagram("root"),
    };

    const result = reparentOrphanDiagrams(diagrams, FOLDERS);

    expect(result.orphan.folderId).toBeUndefined();
    expect(result.filed.folderId).toBe("known");
    expect(result.root.folderId).toBeUndefined();
  });

  it("returns the same reference when nothing is orphaned", () => {
    const diagrams = { filed: makeDiagram("filed", "known") };

    expect(reparentOrphanDiagrams(diagrams, FOLDERS)).toBe(diagrams);
  });

  it("is idempotent", () => {
    const diagrams = { orphan: makeDiagram("orphan", "missing") };

    const once = reparentOrphanDiagrams(diagrams, FOLDERS);

    expect(reparentOrphanDiagrams(once, FOLDERS)).toBe(once);
  });
});
