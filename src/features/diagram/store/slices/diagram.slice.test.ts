import { describe, expect, it } from "vitest";
import type { Diagram } from "../../model/diagram.types";
import { createTestDiagramStore } from "../test-utils";

function importable(folderId?: string | null): Diagram {
  return {
    id: "from-file",
    name: "Shared diagram",
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

describe("importDiagram", () => {
  it("drops a folderId the workspace does not have, so the diagram lands at the root", () => {
    const store = createTestDiagramStore();

    const imported = store.getState().importDiagram(importable("folder-from-another-workspace"));

    expect(imported.folderId).toBeUndefined();
    expect(store.getState().diagrams[imported.id]!.folderId).toBeUndefined();
  });

  it("keeps a folderId that resolves in this workspace", () => {
    const store = createTestDiagramStore();
    const folder = store.getState().addFolder("Team", null);

    const imported = store.getState().importDiagram(importable(folder.id));

    expect(store.getState().diagrams[imported.id]!.folderId).toBe(folder.id);
  });

  it("assigns a fresh id so the source id never collides", () => {
    const store = createTestDiagramStore();

    const imported = store.getState().importDiagram(importable());

    expect(imported.id).not.toBe("from-file");
  });
});

describe("addImportedDiagram", () => {
  it("drops a folderId the workspace does not have", () => {
    const store = createTestDiagramStore();

    const imported = store.getState().addImportedDiagram(importable("ghost-folder"));

    expect(store.getState().diagrams[imported.id]!.folderId).toBeUndefined();
  });

  it("keeps the source id, unlike importDiagram", () => {
    const store = createTestDiagramStore();

    const imported = store.getState().addImportedDiagram(importable());

    expect(imported.id).toBe("from-file");
  });
});
