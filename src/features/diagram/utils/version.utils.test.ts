import { describe, expect, it } from "vitest";
import type { Diagram } from "../model/diagram.types";
import type { VersionDiff } from "../model/diagram.types";
import {
  canMoveNodeInSceneMode,
  computeMergePreview,
  resolveVersionSnapshot,
  versionHasDiff,
} from "./version.utils";

function emptyDiagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    id: "d1",
    name: "Test",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

describe("resolveVersionSnapshot", () => {
  it("returns base when no scene id", () => {
    const d = emptyDiagram({
      snapshot: {
        components: { a: { id: "a", name: "A", type: "system", description: "", parentId: null } },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: { a: { elementId: "a", x: 1, y: 2 } },
    });
    const r = resolveVersionSnapshot(d, null);
    expect(r.versionId).toBeNull();
    expect(r.components.a?.name).toBe("A");
    expect(r.nodeLayouts.a?.x).toBe(1);
  });

  it("merges added and filters removed", () => {
    const d = emptyDiagram({
      snapshot: {
        components: {
          base1: { id: "base1", name: "B1", type: "system", description: "", parentId: null },
          hide: { id: "hide", name: "H", type: "system", description: "", parentId: null },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        base1: { elementId: "base1", x: 0, y: 0 },
        hide: { elementId: "hide", x: 0, y: 0 },
      },
      versions: {
        s1: {
          id: "s1",
          name: "S",
          color: "#000",
          createdAt: 0,
          addedComponents: {
            add1: { id: "add1", name: "A1", type: "container", description: "", parentId: null },
          },
          addedConnections: {},
          removedComponentIds: ["hide"],
          removedConnectionIds: [],
          nodeLayouts: { add1: { elementId: "add1", x: 10, y: 20 } },
        },
      },
    });
    const r = resolveVersionSnapshot(d, "s1");
    expect(r.components.base1).toBeDefined();
    expect(r.components.hide).toBeUndefined();
    expect(r.components.add1?.name).toBe("A1");
    expect(r.nodeLayouts.add1?.x).toBe(10);
  });

  it("applies simultaneous scene additions and removals in one resolve", () => {
    const d = emptyDiagram({
      snapshot: {
        components: {
          keep: { id: "keep", name: "K", type: "system", description: "", parentId: null },
          drop: { id: "drop", name: "D", type: "system", description: "", parentId: null },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: {
        keep: { elementId: "keep", x: 0, y: 0 },
        drop: { elementId: "drop", x: 0, y: 0 },
      },
      versions: {
        s1: {
          id: "s1",
          name: "S",
          color: "#000",
          createdAt: 0,
          addedComponents: {
            onlyInScene: {
              id: "onlyInScene",
              name: "N",
              type: "container",
              description: "",
              parentId: null,
            },
          },
          addedConnections: {},
          removedComponentIds: ["drop"],
          removedConnectionIds: [],
          nodeLayouts: { onlyInScene: { elementId: "onlyInScene", x: 5, y: 6 } },
        },
      },
    });
    const r = resolveVersionSnapshot(d, "s1");
    expect(r.components.keep).toBeDefined();
    expect(r.components.drop).toBeUndefined();
    expect(r.components.onlyInScene?.name).toBe("N");
    expect(r.nodeLayouts.onlyInScene?.x).toBe(5);
  });
});

describe("versionHasDiff", () => {
  it("is false for empty scene diff", () => {
    const sc: VersionDiff = {
      id: "s",
      name: "S",
      color: "#000",
      createdAt: 0,
      addedComponents: {},
      addedConnections: {},
      removedComponentIds: [],
      removedConnectionIds: [],
      nodeLayouts: {},
    };
    expect(versionHasDiff(sc)).toBe(false);
  });

  it("is true when scene has additions or removals", () => {
    const sc: VersionDiff = {
      id: "s",
      name: "S",
      color: "#000",
      createdAt: 0,
      addedComponents: {
        x: { id: "x", name: "X", type: "system", description: "", parentId: null },
      },
      addedConnections: {},
      removedComponentIds: [],
      removedConnectionIds: [],
      nodeLayouts: {},
    };
    expect(versionHasDiff(sc)).toBe(true);
  });
});

describe("computeMergePreview", () => {
  it("throws when scene is missing", () => {
    const d = emptyDiagram();
    expect(() => computeMergePreview(d, "missing")).toThrow("not found");
  });

  it("lists adds, removes, and component conflicts across scenes", () => {
    const shared = {
      id: "dup",
      name: "Dup",
      type: "container" as const,
      description: "",
      parentId: null as string | null,
    };
    const d = emptyDiagram({
      snapshot: {
        components: {
          old: { id: "old", name: "Old", type: "system", description: "", parentId: null },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: { old: { elementId: "old", x: 0, y: 0 } },
      versions: {
        s1: {
          id: "s1",
          name: "A",
          color: "#111",
          createdAt: 0,
          addedComponents: { dup: { ...shared } },
          addedConnections: {},
          removedComponentIds: ["old"],
          removedConnectionIds: [],
          nodeLayouts: { dup: { elementId: "dup", x: 1, y: 1 } },
        },
        s2: {
          id: "s2",
          name: "B",
          color: "#222",
          createdAt: 0,
          addedComponents: { dup: { ...shared } },
          addedConnections: {},
          removedComponentIds: [],
          removedConnectionIds: [],
          nodeLayouts: {},
        },
      },
    });
    const p = computeMergePreview(d, "s1");
    expect(p.componentsToAdd).toHaveLength(1);
    expect(p.componentIdsToRemove).toEqual(["old"]);
    expect(p.conflicts).toHaveLength(1);
    expect(p.conflicts[0]!.conflictingVersionId).toBe("s2");
    expect(p.conflicts[0]!.elementId).toBe("dup");
  });

  it("flags conflict when a scene-added component id already exists on the base diagram", () => {
    const shared = {
      id: "overlap",
      name: "Overlap",
      type: "container" as const,
      description: "",
      parentId: null as string | null,
    };
    const d = emptyDiagram({
      snapshot: {
        components: { overlap: { ...shared } },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      nodeLayouts: { overlap: { elementId: "overlap", x: 0, y: 0 } },
      versions: {
        s1: {
          id: "s1",
          name: "A",
          color: "#111",
          createdAt: 0,
          addedComponents: { overlap: { ...shared, name: "Scene variant" } },
          addedConnections: {},
          removedComponentIds: [],
          removedConnectionIds: [],
          nodeLayouts: {},
        },
      },
    });
    const preview = computeMergePreview(d, "s1");
    const baseConflict = preview.conflicts.find((c) => c.conflictingVersionId === "__diagramBase__");
    expect(baseConflict).toBeDefined();
    expect(baseConflict!.elementId).toBe("overlap");
  });
});

describe("canMoveNodeInSceneMode", () => {
  it("returns true for a node added by the active scene", () => {
    const d = emptyDiagram({
      activeVersionId: "s1",
      versions: {
        s1: {
          id: "s1",
          name: "S",
          color: "#000",
          createdAt: 0,
          addedComponents: {
            sceneNode: {
              id: "sceneNode",
              name: "N",
              type: "system",
              description: "",
              parentId: null,
            },
          },
          addedConnections: {},
          removedComponentIds: [],
          removedConnectionIds: [],
          nodeLayouts: {},
        },
      },
    });
    expect(canMoveNodeInSceneMode(d, "sceneNode")).toBe(true);
  });

  it("returns false for a base snapshot node while a scene is active", () => {
    const d = emptyDiagram({
      activeVersionId: "s1",
      snapshot: {
        components: {
          baseNode: { id: "baseNode", name: "B", type: "system", description: "", parentId: null },
        },
        connections: {},
        flows: {},
        iconLibrary: {},
      },
      versions: {
        s1: {
          id: "s1",
          name: "S",
          color: "#000",
          createdAt: 0,
          addedComponents: {},
          addedConnections: {},
          removedComponentIds: [],
          removedConnectionIds: [],
          nodeLayouts: {},
        },
      },
    });
    expect(canMoveNodeInSceneMode(d, "baseNode")).toBe(false);
  });
});
