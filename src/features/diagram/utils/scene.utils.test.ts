import { describe, expect, it } from "vitest";
import type { Diagram } from "../model/diagram.types";
import { resolveSceneSnapshot } from "./scene.utils";

function emptyDiagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    id: "d1",
    name: "Test",
    level: "context",
    createdAt: "",
    updatedAt: "",
    snapshot: { components: {}, connections: {}, flows: {} },
    nodeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

describe("resolveSceneSnapshot", () => {
  it("returns base when no scene id", () => {
    const d = emptyDiagram({
      snapshot: {
        components: { a: { id: "a", name: "A", type: "system", description: "", parentId: null } },
        connections: {},
        flows: {},
      },
      nodeLayouts: { a: { elementId: "a", x: 1, y: 2 } },
    });
    const r = resolveSceneSnapshot(d, null);
    expect(r.sceneId).toBeNull();
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
      },
      nodeLayouts: {
        base1: { elementId: "base1", x: 0, y: 0 },
        hide: { elementId: "hide", x: 0, y: 0 },
      },
      scenes: {
        s1: {
          id: "s1",
          name: "S",
          color: "#000",
          createdAt: "",
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
    const r = resolveSceneSnapshot(d, "s1");
    expect(r.components.base1).toBeDefined();
    expect(r.components.hide).toBeUndefined();
    expect(r.components.add1?.name).toBe("A1");
    expect(r.nodeLayouts.add1?.x).toBe(10);
  });
});
