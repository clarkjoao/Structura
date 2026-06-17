import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import { findComponentIdsByServiceId } from "./findComponentsByServiceId";

function minimalDiagram(components: Diagram["snapshot"]["components"]): Diagram {
  return {
    id: "d1",
    name: "Test",
    level: "context",
    createdAt: Date.now(),
    updatedAt: Date.now(),
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

describe("findComponentIdsByServiceId", () => {
  it("returns empty array when no components match", () => {
    const diagram = minimalDiagram({
      "el-1": {
        id: "el-1",
        name: "A",
        type: "system",
        description: "",
        parentId: null,
      },
    });

    expect(findComponentIdsByServiceId(diagram, "svc-missing")).toEqual([]);
  });

  it("returns a single matching component id", () => {
    const diagram = minimalDiagram({
      "el-1": {
        id: "el-1",
        name: "A",
        type: "system",
        description: "",
        parentId: null,
        serviceId: "svc-1",
      },
    });

    expect(findComponentIdsByServiceId(diagram, "svc-1")).toEqual(["el-1"]);
  });

  it("returns all matching component ids", () => {
    const diagram = minimalDiagram({
      "el-1": {
        id: "el-1",
        name: "A",
        type: "system",
        description: "",
        parentId: null,
        serviceId: "svc-1",
      },
      "el-2": {
        id: "el-2",
        name: "B",
        type: "system",
        description: "",
        parentId: null,
        serviceId: "svc-2",
      },
      "el-3": {
        id: "el-3",
        name: "C",
        type: "system",
        description: "",
        parentId: null,
        serviceId: "svc-1",
      },
    });

    expect(findComponentIdsByServiceId(diagram, "svc-1")).toEqual(["el-1", "el-3"]);
  });
});
