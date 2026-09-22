import { describe, expect, it } from "vitest";
import type { Diagram, Folder } from "@/features/diagram";
import {
  defaultExportScope,
  diagramsForScope,
  diagramsInFolderTree,
  diagramsInSelection,
} from "./workspaceExportScope";

function diagram(id: string, folderId: string | null = null): Diagram {
  return {
    id,
    name: id,
    level: "context",
    folderId,
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function folder(id: string, parentId: string | null = null): Folder {
  return { id, name: id, parentId };
}

// root: d0 | backend: d1 | backend/auth: d2 | backend/auth/tokens: d3 | frontend: d4
const folders: Record<string, Folder> = {
  backend: folder("backend"),
  auth: folder("auth", "backend"),
  tokens: folder("tokens", "auth"),
  frontend: folder("frontend"),
};
const diagrams = [
  diagram("d0"),
  diagram("d1", "backend"),
  diagram("d2", "auth"),
  diagram("d3", "tokens"),
  diagram("d4", "frontend"),
];
const ids = (list: Diagram[]) => list.map((d) => d.id);

describe("diagramsInFolderTree", () => {
  it("includes every nested subfolder, in workspace order", () => {
    expect(ids(diagramsInFolderTree("backend", diagrams, folders))).toEqual(["d1", "d2", "d3"]);
  });

  it("returns only the leaf's own diagrams for a leaf folder", () => {
    expect(ids(diagramsInFolderTree("tokens", diagrams, folders))).toEqual(["d3"]);
  });

  it("terminates on a parent cycle", () => {
    const cyclic = { a: folder("a", "b"), b: folder("b", "a") };
    const list = [diagram("x", "a"), diagram("y", "b")];
    expect(ids(diagramsInFolderTree("a", list, cyclic))).toEqual(["x", "y"]);
  });
});

describe("diagramsInSelection", () => {
  it("expands a selected folder and keeps selected diagrams, without duplicates", () => {
    const selected = new Set(["auth", "d2", "d4"]);
    expect(ids(diagramsInSelection(selected, diagrams, folders))).toEqual(["d2", "d3", "d4"]);
  });

  it("ignores ids that no longer exist", () => {
    expect(ids(diagramsInSelection(new Set(["gone"]), diagrams, folders))).toEqual([]);
  });
});

describe("diagramsForScope", () => {
  const input = { diagrams, folders, selectedIds: new Set(["d0"]), selectedFolderId: null };

  it("has nothing in the folder scope at the workspace root", () => {
    expect(diagramsForScope("folder", input)).toEqual([]);
  });

  it("returns everything for the workspace scope", () => {
    expect(diagramsForScope("workspace", input)).toHaveLength(5);
  });
});

describe("defaultExportScope", () => {
  it("prefers the selection, then the folder, then the workspace", () => {
    expect(defaultExportScope({ selected: 2, folder: 3, workspace: 5 })).toBe("selected");
    expect(defaultExportScope({ selected: 0, folder: 3, workspace: 5 })).toBe("folder");
    expect(defaultExportScope({ selected: 0, folder: 0, workspace: 5 })).toBe("workspace");
  });
});
