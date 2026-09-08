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

  it("uses step note and step intent when exporting repeated endpoints", () => {
    const components: Record<string, Component> = {
      app: { id: "app", name: "App", type: "system", description: "", parentId: null },
      api: { id: "api", name: "API", type: "system", description: "", parentId: null },
    };
    const connections: Record<string, Connection> = {
      conn1: {
        id: "conn1",
        sourceId: "app",
        targetId: "api",
        label: "stale label",
        intent: "call",
      },
    };
    const flows: Flow[] = [
      {
        id: "flow-2",
        name: "Upload",
        mermaid: "sequenceDiagram",
        diagramId: "d1",
        entryStepId: "s1",
        steps: {
          s1: {
            id: "s1",
            type: "action",
            connectionId: "conn1",
            componentId: "app",
            note: "Solicita iniciar upload",
            connectionIntent: "call",
            next: "s2",
          },
          s2: {
            id: "s2",
            type: "action",
            connectionId: "conn1",
            componentId: "app",
            note: "Retorna Upload URL",
            connectionIntent: "async-message",
          },
        },
      },
    ];

    const exported = exportMermaid(flows, components, connections);

    expect(exported).toContain("A->>A2: Solicita iniciar upload");
    expect(exported).toContain("A-->>A2: Retorna Upload URL");
    expect(exported).not.toContain("stale label");
  });

  // The keyword used to be smuggled through `conditionLabel`, so a block was a
  // loop only because someone had typed the word "loop" as its question. It has
  // a field of its own now, and the label is free to be a label again.
  it("preserves loop keyword when exporting condition blocks", () => {
    const components: Record<string, Component> = {
      app: { id: "app", name: "App", type: "system", description: "", parentId: null },
      drive: { id: "drive", name: "Drive", type: "system", description: "", parentId: null },
    };
    const connections: Record<string, Connection> = {
      conn1: {
        id: "conn1",
        sourceId: "app",
        targetId: "drive",
        label: "stale",
        intent: "call",
      },
    };
    const flows: Flow[] = [
      {
        id: "flow-3",
        name: "Chunk upload",
        mermaid: "sequenceDiagram",
        diagramId: "d1",
        entryStepId: "c1",
        steps: {
          c1: {
            id: "c1",
            type: "condition",
            conditionKind: "loop",
            conditionLabel: "Enquanto restar parte",
            branches: [{ label: "Envio em chunks", nextId: "a1" }],
          },
          a1: {
            id: "a1",
            type: "action",
            componentId: "app",
            connectionId: "conn1",
            note: "Envia parte do vídeo",
            connectionIntent: "call",
          },
        },
      },
    ];

    const exported = exportMermaid(flows, components, connections);

    expect(exported).toContain("loop Envio em chunks");
    expect(exported).not.toContain("alt loop");
  });

  it("exports response step on same connection in reverse direction", () => {
    const components: Record<string, Component> = {
      api: { id: "api", name: "API", type: "system", description: "", parentId: null },
      svc: { id: "svc", name: "Svc", type: "system", description: "", parentId: null },
    };
    const connections: Record<string, Connection> = {
      conn1: {
        id: "conn1",
        sourceId: "api",
        targetId: "svc",
        label: "Authenticate",
        intent: "call",
      },
    };
    const flows: Flow[] = [
      {
        id: "flow-4",
        name: "Auth roundtrip",
        mermaid: "sequenceDiagram",
        diagramId: "d1",
        entryStepId: "s1",
        steps: {
          s1: {
            id: "s1",
            type: "action",
            connectionId: "conn1",
            componentId: "api",
            note: "Authenticate",
            connectionIntent: "call",
            next: "s2",
          },
          s2: {
            id: "s2",
            type: "action",
            connectionId: "conn1",
            componentId: "svc",
            note: "Token",
            connectionIntent: "async-message",
            payloadDirection: "response",
          },
        },
      },
    ];

    const exported = exportMermaid(flows, components, connections);

    expect(exported).toContain("A->>S: Authenticate");
    expect(exported).toContain("S-->>A: Token");
  });
});
