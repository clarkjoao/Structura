import { describe, expect, it } from "vitest";
import type { Connection, Flow, FlowStep } from "@/features/diagram";
import { suggestFlowName } from "./suggestFlowName";

const NAMES: Record<string, string> = { web: "Web", api: "API", db: "Ledger" };
const nameOf = (id: string) => NAMES[id];
const CONNECTIONS: Record<string, Connection> = {
  e1: { id: "e1", sourceId: "web", targetId: "api", label: "POST /pay" },
};

const flow = (steps: FlowStep[]): Flow => ({
  id: "f",
  diagramId: "d",
  name: "",
  mermaid: "",
  entryStepId: steps[0]?.id,
  steps: Object.fromEntries(steps.map((step) => [step.id, step])),
});

describe("suggestFlowName", () => {
  it("names a flow by where it starts and where it ends", () => {
    const f = flow([
      { id: "s1", type: "action", next: "s2", componentId: "web" },
      { id: "s2", type: "action", next: "s3", componentId: "api" },
      { id: "s3", type: "action", componentId: "db" },
    ]);
    expect(suggestFlowName(f, nameOf, CONNECTIONS)).toBe("Web → Ledger");
  });

  it("takes both ends of a call, so a flow of edges still starts and ends somewhere", () => {
    const f = flow([{ id: "s1", type: "action", connectionId: "e1" }]);
    expect(suggestFlowName(f, nameOf, CONNECTIONS)).toBe("Web → API");
  });

  it("reads a response the way it travels", () => {
    const f = flow([
      { id: "s1", type: "action", connectionId: "e1", payloadDirection: "response" },
    ]);
    expect(suggestFlowName(f, nameOf, CONNECTIONS)).toBe("API → Web");
  });

  it("is one name when the flow stays on one element", () => {
    const f = flow([{ id: "s1", type: "action", componentId: "api" }]);
    expect(suggestFlowName(f, nameOf, CONNECTIONS)).toBe("API");
  });

  it("offers nothing for a flow that names nothing yet", () => {
    expect(suggestFlowName(flow([{ id: "s1", type: "action" }]), nameOf, CONNECTIONS)).toBeNull();
  });
});
