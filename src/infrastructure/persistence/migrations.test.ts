import { describe, expect, it } from "vitest";
import { migrateDiagram } from "./migrations";
import type { Diagram } from "@/features/diagram";
import type { Component } from "@/features/diagram/model/component.types";

function makeDiagram(components: Record<string, Component>): Diagram {
  return {
    id: "d1",
    name: "Test",
    level: "context",
    createdAt: 1,
    updatedAt: 1,
    snapshot: {
      components,
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("migrateDiagram sanitises corrupted component types", () => {
  it("repairs a known corrupted type by falling back to 'component'", () => {
    const corrupted = {
      id: "el-1",
      type: "API Endpoints /api/v1 · REST",
      name: "API",
      description: "",
      parentId: null,
    } as unknown as Component;
    const diagram = makeDiagram({ "el-1": corrupted });
    const migrated = migrateDiagram(diagram, 1);
    expect(migrated.snapshot.components["el-1"].type).toBe("component");
  });

  it("preserves built-in types", () => {
    const apiGroup = {
      id: "el-1",
      type: "api-group",
      name: "API",
      description: "",
      parentId: null,
    } as unknown as Component;
    const diagram = makeDiagram({ "el-1": apiGroup });
    const migrated = migrateDiagram(diagram, 1);
    expect(migrated.snapshot.components["el-1"].type).toBe("api-group");
  });

  it("preserves plugin namespaced types", () => {
    const pluginComp = {
      id: "el-1",
      type: "leanix/factsheet",
      name: "Fact",
      description: "",
      parentId: null,
    } as unknown as Component;
    const diagram = makeDiagram({ "el-1": pluginComp });
    const migrated = migrateDiagram(diagram, 1);
    expect(migrated.snapshot.components["el-1"].type).toBe("leanix/factsheet");
  });

  it("repairs corrupted types in active scene too", () => {
    const corrupted = {
      id: "el-1",
      type: "API Endpoints /api/v1 · REST",
      name: "API",
      description: "",
      parentId: null,
    } as unknown as Component;
    const diagram = makeDiagram({});
    diagram.scenes = {
      s1: {
        id: "s1",
        name: "Scene",
        color: "#000",
        createdAt: 1,
        addedComponents: { "el-1": corrupted },
        addedConnections: {},
        removedComponentIds: [],
        removedConnectionIds: [],
        nodeLayouts: {},
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
    diagram.activeSceneId = "s1";

    const migrated = migrateDiagram(diagram, 1);
    expect(migrated.scenes?.s1.addedComponents["el-1"].type).toBe("component");
  });
});
