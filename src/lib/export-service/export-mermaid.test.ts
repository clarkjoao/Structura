import { describe, expect, it } from "vitest";
import type { Component, Connection, Flow } from "@/features/diagram";
import { exportMermaid } from "./export-mermaid";

describe("exportMermaid", () => {
  it("rebuilds Mermaid from flow steps instead of using stale stored text", () => {
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
        label: "Dispatch job",
        intent: "call",
        direction: "unidirectional",
      },
    };
    const flows: Flow[] = [
      {
        id: "flow-1",
        name: "Job dispatch",
        mermaid: "sequenceDiagram",
        diagramId: "d1",
        entryStepId: "step-1",
        steps: {
          "step-1": {
            id: "step-1",
            type: "action",
            connectionId: "conn1",
            description: "Enqueue background work",
          },
        },
      },
    ];

    const exported = exportMermaid(flows, components, connections);

    expect(exported).toContain("## Job dispatch");
    expect(exported).toContain("participant A as API");
    expect(exported).toContain("participant W as Worker");
    expect(exported).toContain("A->>W: Dispatch job");
    expect(exported).toContain("Note over A: Enqueue background work");
  });
});
