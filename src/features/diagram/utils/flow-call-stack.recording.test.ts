import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "../model/flow.types";
import { buildFlowOutline } from "./flow-outline";
import { buildCallStack, directionForRecordedClick, framesOpenAfter } from "./flow-call-stack";

/**
 * What a click on an edge means while recording.
 *
 * The recorder never had to ask the author which way a message travels, and it
 * never did — so every script recorded in the app read as a flat sequence. The
 * answer was always in what had been recorded already: an edge the script went
 * down and has not come back from can only be the way back.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Rec", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

const direction = (f: Flow, tail: string | null, connectionId: string) =>
  directionForRecordedClick(f, buildFlowOutline(f), tail, connectionId);

describe("the calls still owed a return, after a given step", () => {
  it("counts the call a step opens", () => {
    const f = flow({ s1: { connectionId: "c1", payloadDirection: "request" } });

    expect(framesOpenAfter(buildCallStack(f, buildFlowOutline(f)), "s1")).toEqual(["s1"]);
  });

  it("stops counting it once the answer arrives", () => {
    const f = flow({
      s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
      s2: { connectionId: "c1", payloadDirection: "response" },
    });

    expect(framesOpenAfter(buildCallStack(f, buildFlowOutline(f)), "s2")).toEqual([]);
  });

  it("owes nothing before anything has been recorded", () => {
    const f = flow({ s1: { componentId: "a" } });

    expect(framesOpenAfter(buildCallStack(f, buildFlowOutline(f)), null)).toEqual([]);
  });
});

describe("a click on an edge says which way it travels", () => {
  it("is a call going out on an edge the script has not been down", () => {
    const f = flow({ s1: { componentId: "a" } });

    expect(direction(f, "s1", "c1")).toBe("request");
  });

  it("is the very first thing recorded, so there is nothing to answer", () => {
    const f = flow({ s1: { componentId: "a" } });

    expect(direction(f, null, "c1")).toBe("request");
  });

  it("is the way back on an edge the script went down and has not returned from", () => {
    const f = flow({ s1: { connectionId: "c1", payloadDirection: "request" } });

    expect(direction(f, "s1", "c1")).toBe("response");
  });

  it("is a call again once the previous one was answered", () => {
    const f = flow({
      s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
      s2: { connectionId: "c1", payloadDirection: "response" },
    });

    expect(direction(f, "s2", "c1")).toBe("request");
  });

  it("answers the innermost open call, not an outer one on another edge", () => {
    const f = flow({
      s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
      s2: { connectionId: "c2", payloadDirection: "request" },
    });

    expect(direction(f, "s2", "c2")).toBe("response");
    // `c1` is still open too, so clicking it is also a way back.
    expect(direction(f, "s2", "c1")).toBe("response");
    expect(direction(f, "s2", "c3")).toBe("request");
  });

  it("does not treat an async call as owed a return", () => {
    const f = flow({ s1: { connectionId: "c1", payloadDirection: "request", isAsync: true } });

    expect(direction(f, "s1", "c1")).toBe("request");
  });
});

describe("recording a nested call produces a script that reads as one", () => {
  it("gives the three-level checkout the depths the reading draws", () => {
    // Exactly the clicks someone would make: down, down, down, back, back, back.
    const clicks = ["c1", "c2", "c3", "c3", "c2", "c1"];
    const steps: Record<string, Partial<FlowStep>> = {};
    let built = flow({});

    clicks.forEach((connectionId, index) => {
      const id = `s${index + 1}`;
      const tail = index === 0 ? null : `s${index}`;
      const payloadDirection = index === 0 ? "request" : direction(built, tail, connectionId);
      steps[id] = { connectionId, payloadDirection };
      if (tail) steps[tail]!.next = id;
      built = flow(steps);
    });

    const stack = buildCallStack(built, buildFlowOutline(built));
    const depths = buildFlowOutline(built).rows.map(
      (row) => stack.byStep.get(row.stepId)!.callDepth,
    );

    expect(depths).toEqual([0, 1, 2, 2, 1, 0]);
    expect(stack.orphanResponses).toEqual([]);
  });
});
