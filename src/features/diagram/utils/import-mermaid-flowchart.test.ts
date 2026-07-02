import { describe, expect, it, vi } from "vitest";
import type { Component, FlowNodeShape } from "../model/diagram.types";
import { parseMermaidFlowchart } from "./import-mermaid-flowchart";

const { generateIdMock } = vi.hoisted(() => ({
  generateIdMock: vi.fn(),
}));

vi.mock("./generate-id", () => ({
  generateId: (prefix: string) => generateIdMock(prefix),
}));

function flowNode(id: string, name: string, shape: FlowNodeShape): Component {
  return {
    id,
    name,
    description: "",
    parentId: null,
    type: "processos",
    flowShape: shape,
  };
}

describe("parseMermaidFlowchart", () => {
  it("parses a simple LR flowchart with two nodes and one edge", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);

    const result = parseMermaidFlowchart(
      "flowchart LR\nA --> B",
      {},
      {},
      { x: 0, y: 0 },
    );

    expect(result.errors).toEqual([]);
    expect(result.newComponents).toHaveLength(2);
    expect(result.newConnections).toHaveLength(1);
    expect(result.layouts).toHaveLength(2);
    expect(result.newComponents[0]).toMatchObject({
      type: "processos",
      name: "A",
      flowShape: "rectangle",
    });
    expect(result.newConnections[0]).toMatchObject({
      intent: "dependency",
      label: "",
    });
  });

  it("identifies diamond shape from braces syntax", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);

    const result = parseMermaidFlowchart(
      "flowchart TD\nDecision{Yes or No}",
      {},
      {},
      { x: 0, y: 0 },
    );

    expect(result.errors).toEqual([]);
    expect(result.newComponents).toHaveLength(1);
    expect(result.newComponents[0]).toMatchObject({
      name: "Yes or No",
      flowShape: "diamond",
    });
  });

  it("returns a descriptive error for invalid flowchart input", () => {
    const result = parseMermaidFlowchart(
      "sequenceDiagram\nA->>B",
      {},
      {},
      { x: 0, y: 0 },
    );

    expect(result.errors).toEqual(["Not a flowchart diagram"]);
    expect(result.newComponents).toEqual([]);
    expect(result.newConnections).toEqual([]);
    expect(result.layouts).toEqual([]);
  });

  it("reports errors for unparseable lines while continuing", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);

    const result = parseMermaidFlowchart(
      ["flowchart LR", "A --> B", "subgraph cluster"].join("\n"),
      {},
      {},
      { x: 0, y: 0 },
    );

    expect(result.newComponents).toHaveLength(2);
    expect(result.errors).toContain("Failed to parse line: subgraph cluster");
  });

  it("reuses existing component by name (case-insensitive)", () => {
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-x`);

    const existingComponents = {
      c1: flowNode("c1", "Payment", "rectangle"),
    };

    const result = parseMermaidFlowchart(
      "flowchart LR\nPay[Payment] --> B",
      existingComponents,
      {},
      { x: 0, y: 0 },
    );

    expect(result.newComponents).toHaveLength(1);
    expect(result.newComponents[0].name).toBe("B");
    expect(result.layouts).toHaveLength(1);
  });

  it("parses pipe-labeled edges (Mermaid -->|label| syntax)", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);

    const result = parseMermaidFlowchart(
      ["flowchart TD", "Decision{Yes or No}", "Decision -->|sim| Process", "Process[Done]"].join(
        "\n",
      ),
      {},
      {},
      { x: 0, y: 0 },
    );

    expect(result.errors).toEqual([]);
    expect(result.newConnections).toHaveLength(1);
    expect(result.newConnections[0].label).toBe("sim");
  });

  it("parses Mermaid example with inline target shapes and pipe labels", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);

    const result = parseMermaidFlowchart(
      [
        "flowchart LR",
        "A[Hard] -->|Text| B(Round)",
        "B --> C{Decision}",
        "C -->|One| D[Result 1]",
        "C -->|Two| E[Result 2]",
      ].join("\n"),
      {},
      {},
      { x: 0, y: 0 },
    );

    expect(result.errors).toEqual([]);
    expect(result.newComponents).toHaveLength(5);
    expect(result.newConnections).toHaveLength(4);

    const byName = Object.fromEntries(result.newComponents.map((c) => [c.name, c]));
    expect(byName.Hard).toMatchObject({ flowShape: "rectangle" });
    expect(byName.Round).toMatchObject({ flowShape: "rounded" });
    expect(byName.Decision).toMatchObject({ flowShape: "diamond" });
    expect(byName["Result 1"]).toMatchObject({ flowShape: "rectangle" });
    expect(byName["Result 2"]).toMatchObject({ flowShape: "rectangle" });

    const labels = result.newConnections.map((c) => c.label).sort();
    expect(labels).toEqual(["", "One", "Text", "Two"]);
  });

  it("parses labeled and styled edge variants", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);

    const result = parseMermaidFlowchart(
      [
        "flowchart LR",
        "A --> B: done",
        "B -- maybe --> C",
        "C ==> D",
        "D -.-> E",
      ].join("\n"),
      {},
      {},
      { x: 0, y: 0 },
    );

    expect(result.errors).toEqual([]);
    expect(result.newConnections).toHaveLength(4);
    expect(result.newConnections[0].label).toBe("done");
    expect(result.newConnections[1].label).toBe("maybe");
  });
});
