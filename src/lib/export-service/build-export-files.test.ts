import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram } from "@/features/diagram";
import { buildDiagramExportFiles } from "./build-export-files";

function minimalDiagram(overrides: Partial<Diagram> = {}): Diagram {
  const base: Diagram = {
    id: "d1",
    name: "Payments Platform",
    level: "context",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    snapshot: {
      components: {},
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  return { ...base, ...overrides, snapshot: { ...base.snapshot, ...overrides.snapshot } };
}

describe("buildDiagramExportFiles", () => {
  it("builds consistent filenames for single and flow exports", () => {
    const diagram = minimalDiagram();
    diagram.snapshot.components.api = {
      id: "api",
      name: "API",
      type: "system",
      description: "",
      parentId: null,
    };

    const { baseName, files } = buildDiagramExportFiles({
      diagram,
      flows: [],
      serviceCatalog: {},
      formats: ["json", "drawio"],
    });

    expect(baseName).toBe("payments-platform");
    expect(files.map((file) => file.filename)).toEqual([
      "payments-platform.json",
      "payments-platform.drawio",
    ]);
  });

  it("uses the flows suffix for Mermaid exports", () => {
    const diagram = minimalDiagram();

    const { files } = buildDiagramExportFiles({
      diagram,
      flows: [
        {
          id: "flow-1",
          name: "Checkout",
          mermaid: "sequenceDiagram",
          diagramId: "d1",
          steps: {},
        },
      ],
      serviceCatalog: {},
      formats: ["mermaid"],
    });

    expect(files[0]?.filename).toBe("payments-platform-flows.md");
  });

  it("uses trunk snapshot for Mermaid so scene-filtered caller graphs cannot empty flow export", () => {
    const components: Record<string, Component> = {
      api: {
        id: "api",
        name: "API",
        type: "system",
        description: "",
        parentId: null,
      },
      worker: {
        id: "worker",
        name: "Worker",
        type: "system",
        description: "",
        parentId: null,
      },
    };
    const connections: Record<string, Connection> = {
      conn1: {
        id: "conn1",
        sourceId: "api",
        targetId: "worker",
        label: "Ping",
        intent: "call",
        direction: "unidirectional",
      },
    };
    const diagram = minimalDiagram({
      snapshot: {
        components,
        connections,
        flows: {
          "flow-1": {
            id: "flow-1",
            name: "Ping flow",
            mermaid: "sequenceDiagram",
            diagramId: "d1",
            entryStepId: "step-1",
            steps: {
              "step-1": {
                id: "step-1",
                type: "action",
                connectionId: "conn1",
              },
            },
          },
        },
        iconLibrary: {},
      },
    });

    const { files } = buildDiagramExportFiles({
      diagram,
      flows: Object.values(diagram.snapshot.flows),
      serviceCatalog: {},
      formats: ["mermaid"],
    });

    const content = files[0]?.content ?? "";
    expect(content).toContain("participant A as API");
    expect(content).toContain("A->>W: Ping");
  });
});
