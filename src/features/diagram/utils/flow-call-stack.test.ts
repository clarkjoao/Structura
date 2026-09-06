import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "../model/flow.types";
import { buildFlowOutline } from "./flow-outline";
import { buildCallStack } from "./flow-call-stack";

/**
 * The depth a reading is at, and who is still owed a return.
 *
 * Every case here is stated in terms of steps and directions, never of the
 * stack's internals: the contract is the depth on the row and the returns the
 * reading has to draw, and the walk is free to change shape underneath.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entry = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return {
    id: "f1",
    name: "Flow",
    mermaid: "",
    diagramId: "d1",
    entryStepId: entry,
    steps: built,
  };
}

/** Depth per step id, which is what the spine renders from. */
function depths(f: Flow): Record<string, number> {
  const stack = buildCallStack(f, buildFlowOutline(f));
  const out: Record<string, number> = {};
  for (const [stepId, info] of stack.byStep) out[stepId] = info.callDepth;
  return out;
}

function stack(f: Flow) {
  return buildCallStack(f, buildFlowOutline(f));
}

/** A request, a response on the same connection, and the step between them. */
const CALL_AND_RETURN = {
  s1: { connectionId: "c1", payloadDirection: "request" as const, next: "s2" },
  s2: { componentId: "b", next: "s3" },
  s3: { connectionId: "c1", payloadDirection: "response" as const },
};

describe("a request opens a call that is owed a return", () => {
  it("opens a frame for a request on a connection", () => {
    const result = stack(flow(CALL_AND_RETURN));

    expect(result.byStep.get("s1")!.opensFrameId).toBe("s1");
    expect(result.frames.get("s1")!.connectionId).toBe("c1");
  });

  it("opens nothing for a step that names a connection with no direction", () => {
    const result = stack(flow({ s1: { connectionId: "c1" } }));

    expect(result.byStep.get("s1")!.opensFrameId).toBeNull();
    expect(result.frames.size).toBe(0);
  });

  it("opens nothing for a step that names only a component", () => {
    const result = stack(flow({ s1: { componentId: "a" } }));

    expect(result.byStep.get("s1")!.opensFrameId).toBeNull();
    expect(result.frames.size).toBe(0);
  });

  it("leaves the depth alone for a step that opens nothing", () => {
    const result = depths(flow({ s1: { componentId: "a", next: "s2" }, s2: { componentId: "b" } }));

    expect(result).toEqual({ s1: 0, s2: 0 });
  });
});

describe("a response closes the nearest call it answers", () => {
  it("closes its own call", () => {
    const result = stack(flow(CALL_AND_RETURN));

    expect(result.byStep.get("s3")!.closesFrameId).toBe("s1");
    expect(result.orphanResponses).toEqual([]);
  });

  it("closes the calls left open above it, each as a return the reading draws", () => {
    const result = stack(
      flow({
        s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
        s2: { connectionId: "c2", payloadDirection: "request", next: "s3" },
        s3: { connectionId: "c1", payloadDirection: "response" },
      }),
    );

    expect(result.byStep.get("s3")!.closesFrameId).toBe("s1");
    expect(result.derivedReturnsBefore.get("s3")).toEqual([
      { frameId: "s2", beforeStepId: "s3", callDepth: 1 },
    ]);
  });

  it("closes the innermost of two calls on the same connection", () => {
    const result = stack(
      flow({
        s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
        s2: { connectionId: "c1", payloadDirection: "request", next: "s3" },
        s3: { connectionId: "c1", payloadDirection: "response" },
      }),
    );

    expect(result.byStep.get("s3")!.closesFrameId).toBe("s2");
  });

  it("reports a response nobody called for, and leaves the depth where it was", () => {
    const result = stack(
      flow({
        s1: { componentId: "a", next: "s2" },
        s2: { connectionId: "c9", payloadDirection: "response" },
      }),
    );

    expect(result.orphanResponses).toEqual(["s2"]);
    expect(result.byStep.get("s2")!.callDepth).toBe(0);
    expect(result.byStep.get("s2")!.closesFrameId).toBeNull();
  });
});

describe("a call nobody returns does not deepen the reading", () => {
  it("leaves the step after an async call at the same depth", () => {
    const result = depths(
      flow({
        s1: { connectionId: "c1", payloadDirection: "request", isAsync: true, next: "s2" },
        s2: { componentId: "b" },
      }),
    );

    expect(result).toEqual({ s1: 0, s2: 0 });
  });

  it("keeps an async call out of the breadcrumb", () => {
    const result = stack(
      flow({
        s1: { connectionId: "c1", payloadDirection: "request", isAsync: true, next: "s2" },
        s2: { componentId: "b" },
      }),
    );

    expect(result.byStep.get("s1")!.openFrameIds).toEqual([]);
    expect(result.byStep.get("s2")!.openFrameIds).toEqual([]);
  });

  it("refuses to let a later response close an async call", () => {
    const result = stack(
      flow({
        s1: { connectionId: "c1", payloadDirection: "request", isAsync: true, next: "s2" },
        s2: { connectionId: "c1", payloadDirection: "response" },
      }),
    );

    expect(result.orphanResponses).toEqual(["s2"]);
  });
});

describe("depth counts the calls open around a step", () => {
  it("puts a call and its return on the same row", () => {
    const result = depths(flow(CALL_AND_RETURN));

    expect(result.s1).toBe(0);
    expect(result.s3).toBe(0);
  });

  it("puts the work inside a call one level in", () => {
    const result = depths(flow(CALL_AND_RETURN));

    expect(result.s2).toBe(1);
  });

  it("reads three levels the way the reading draws them", () => {
    // Checkout: cliente → api → pagamentos → antifraude, then back out.
    const result = depths(
      flow({
        s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
        s2: { connectionId: "c2", payloadDirection: "request", next: "s3" },
        s3: { connectionId: "c3", payloadDirection: "request", next: "s4" },
        s4: { connectionId: "c3", payloadDirection: "response", next: "s5" },
        s5: { connectionId: "c4", payloadDirection: "request", next: "s7" },
        s7: { connectionId: "c2", payloadDirection: "response", next: "s8" },
        s8: { connectionId: "c5", payloadDirection: "request", isAsync: true, next: "s9" },
        s9: { connectionId: "c1", payloadDirection: "response" },
      }),
    );

    expect(result).toEqual({ s1: 0, s2: 1, s3: 2, s4: 2, s5: 2, s7: 1, s8: 1, s9: 0 });
  });

  it("names the calls in play, outermost first, including the one being made", () => {
    const result = stack(
      flow({
        s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
        s2: { connectionId: "c2", payloadDirection: "request", next: "s3" },
        s3: { connectionId: "c3", payloadDirection: "request" },
      }),
    );

    expect(result.byStep.get("s3")!.openFrameIds).toEqual(["s1", "s2", "s3"]);
  });
});

describe("a branch reads from the fork, not from its sibling", () => {
  it("gives a sibling branch the depth the condition had", () => {
    const result = depths(
      flow({
        s1: { connectionId: "c1", payloadDirection: "request", next: "cond" },
        cond: {
          type: "condition",
          conditionLabel: "ok?",
          branches: [
            { label: "A", nextId: "a1" },
            { label: "B", nextId: "b1" },
          ],
        },
        // A opens a call and never closes it.
        a1: { connectionId: "c2", payloadDirection: "request", next: "a2" },
        a2: { componentId: "x" },
        b1: { componentId: "y" },
      }),
    );

    expect(result.cond).toBe(1);
    expect(result.a2).toBe(2);
    expect(result.b1).toBe(1);
  });
});

describe("a script that declares no directions reads exactly as before", () => {
  it("puts every step at depth zero and owes nothing", () => {
    const result = stack(
      flow({
        s1: { componentId: "a", next: "s2" },
        s2: { connectionId: "c1", next: "s3" },
        s3: { componentId: "b" },
      }),
    );

    expect([...result.byStep.values()].every((info) => info.callDepth === 0)).toBe(true);
    expect(result.frames.size).toBe(0);
    expect(result.derivedReturnsBefore.size).toBe(0);
    expect(result.orphanResponses).toEqual([]);
  });
});
