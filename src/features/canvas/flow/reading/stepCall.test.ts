import { describe, expect, it } from "vitest";
import type { Connection, FlowStep } from "@/features/diagram";
import { describeStepCall } from "./stepCall";

/**
 * The call is the headline of a step in the reading rail, so the rules for
 * what counts as one — and what does not — are worth pinning down: a wrong
 * fallback here puts a port id where a reader expects an endpoint.
 */

function connection(over: Partial<Connection> = {}): Connection {
  return { id: "c1", sourceId: "gateway", targetId: "antifraud", label: "POST /v2/score", ...over };
}

function step(over: Partial<FlowStep> = {}): FlowStep {
  return { id: "s1", type: "action", ...over };
}

const CONNECTIONS = { c1: connection() };

describe("the call a step makes", () => {
  it("is the label the author gave the connection", () => {
    const call = describeStepCall(step({ connectionId: "c1" }), CONNECTIONS);

    expect(call?.label).toBe("POST /v2/score");
  });

  it("says which way the payload runs when the step says", () => {
    const call = describeStepCall(
      step({ connectionId: "c1", payloadDirection: "response" }),
      CONNECTIONS,
    );

    expect(call?.direction).toBe("response");
  });

  it("leaves the direction unsaid when the step does not say", () => {
    const call = describeStepCall(step({ connectionId: "c1" }), CONNECTIONS);

    expect(call?.direction).toBeNull();
  });

  it("falls back to the technology when the edge was never named", () => {
    const call = describeStepCall(step({ connectionId: "c1" }), {
      c1: connection({ label: "", technology: "gRPC" }),
    });

    expect(call?.label).toBe("gRPC");
  });

  it("treats a label of only spaces as no label", () => {
    const call = describeStepCall(step({ connectionId: "c1" }), {
      c1: connection({ label: "   ", technology: "gRPC" }),
    });

    expect(call?.label).toBe("gRPC");
  });
});

describe("a step that is not a call says so by having none", () => {
  it("has nothing to say for a step that points at a node", () => {
    expect(describeStepCall(step({ componentId: "gateway" }), CONNECTIONS)).toBeNull();
  });

  it("has nothing to say once the connection is gone from the view", () => {
    expect(describeStepCall(step({ connectionId: "vanished" }), CONNECTIONS)).toBeNull();
  });

  it("has nothing to say for an edge with neither a label nor a technology", () => {
    const call = describeStepCall(step({ connectionId: "c1" }), { c1: connection({ label: "" }) });

    expect(call).toBeNull();
  });

  it("never offers the handle id as a call: it names a port, not an endpoint", () => {
    const call = describeStepCall(step({ connectionId: "c1", handleId: "source-0" }), {
      c1: connection({ label: "" }),
    });

    expect(call).toBeNull();
  });

  it("has nothing to say when there is no step in hand", () => {
    expect(describeStepCall(null, CONNECTIONS)).toBeNull();
  });
});
