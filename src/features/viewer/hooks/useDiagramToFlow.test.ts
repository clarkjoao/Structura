import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Component, Connection, Diagram } from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { useDiagramToFlow } from "./useDiagramToFlow";

function component(partial: Record<string, unknown>): Component {
  return { description: "", parentId: null, ...partial } as unknown as Component;
}

function connection(id: string, sourceId: string, targetId: string): Connection {
  return { id, sourceId, targetId, label: "" };
}

function diagramOf(components: Component[], connections: Connection[] = []): Diagram {
  return {
    id: "d1",
    name: "Viewed",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: Object.fromEntries(connections.map((c) => [c.id, c])),
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function nodeById(diagram: Diagram, id: string) {
  const { result } = renderHook(() => useDiagramToFlow(diagram));
  const node = result.current.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Expected node ${id} in the viewer graph`);
  return node;
}

describe("useDiagramToFlow — cloud service icons", () => {
  it("maps awsService onto cloudService the way CustomNode reads it", () => {
    const node = nodeById(
      diagramOf([component({ id: "n1", name: "Fn", type: "aws-compute", awsService: "lambda" })]),
      "n1",
    );
    expect(node.data.cloudService).toBe("lambda");
  });

  it("maps GCP and Azure service ids the same way", () => {
    const gcp = nodeById(
      diagramOf([
        component({ id: "g1", name: "Run", type: "gcp-compute", gcpService: "cloud-run" }),
      ]),
      "g1",
    );
    const azure = nodeById(
      diagramOf([
        component({
          id: "a1",
          name: "App",
          type: "azure-compute",
          azureService: "app-service",
        }),
      ]),
      "a1",
    );
    expect(gcp.data.cloudService).toBe("cloud-run");
    expect(azure.data.cloudService).toBe("app-service");
  });
});

describe("useDiagramToFlow — descriptor types and colors", () => {
  it("uses the registry rfType for svg, process-node, and external-element", () => {
    const diagram = diagramOf([
      component({ id: "s1", name: "Mark", type: "svg", svgContent: "<svg />" }),
      component({ id: "p1", name: "Step", type: "process-node", flowShape: "rectangle" }),
      component({
        id: "x1",
        name: "Other",
        type: "external-element",
        referenceDiagramId: "d2",
      }),
    ]);
    expect(nodeById(diagram, "s1").type).toBe("svg");
    expect(nodeById(diagram, "p1").type).toBe("flow-node");
    expect(nodeById(diagram, "x1").type).toBe("external-element");
  });

  it("degrades an unregistered plugin type to unknown", () => {
    expect(
      nodeById(diagramOf([component({ id: "u1", name: "Plug", type: "acme/widget" })]), "u1").type,
    ).toBe("unknown");
  });

  it("prefers customColor over panelColor on a C4 node", () => {
    const node = nodeById(
      diagramOf([
        component({
          id: "c1",
          name: "Sys",
          type: "system",
          panelColor: "#111111",
          customColor: "#ff6600",
        }),
      ]),
      "c1",
    );
    expect(node.data.customColor).toBe("#ff6600");
  });
});

describe("useDiagramToFlow — handle counts", () => {
  it("counts incoming and outgoing connections instead of hardcoding 1", () => {
    const diagram = diagramOf(
      [
        component({ id: "src", name: "A", type: "system" }),
        component({ id: "mid", name: "B", type: "system" }),
        component({ id: "a", name: "C", type: "system" }),
        component({ id: "b", name: "D", type: "system" }),
      ],
      [
        connection("e1", "src", "mid"),
        connection("e2", "a", "mid"),
        connection("e3", "b", "mid"),
        connection("e4", "mid", "src"),
      ],
    );
    const mid = nodeById(diagram, "mid");
    expect(mid.data.incomingCount).toBe(3);
    expect(mid.data.outgoingCount).toBe(1);
  });

  it("locks editor controls on every node", () => {
    const node = nodeById(diagramOf([component({ id: "n1", name: "Sys", type: "system" })]), "n1");
    expect(node.data.controlsDisabled).toBe(true);
    expect(node.draggable).toBe(false);
  });
});
