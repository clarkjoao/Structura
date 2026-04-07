import { describe, expect, it } from "vitest";
import type { Flow } from "../model/flow.types";
import { getOrderedStepIds, getStepCount, walkFlow } from "./flow-traversal";

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: "flow-1",
    name: "Test Flow",
    mermaid: "",
    diagramId: "d-1",
    steps: {},
    ...overrides,
  };
}

describe("flow traversal", () => {
  it("walks a linear flow in correct order", () => {
    const flow = makeFlow({
      entryStepId: "a",
      steps: {
        a: { id: "a", type: "action", next: "b" },
        b: { id: "b", type: "action", next: "c" },
        c: { id: "c", type: "action" },
      },
    });
    expect(getOrderedStepIds(flow)).toEqual(["a", "b", "c"]);
    expect(getStepCount(flow)).toBe(3);
  });

  it("walks both paths when a condition has branches", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: {
          id: "s1",
          type: "condition",
          branches: [
            { label: "yes", nextId: "s2" },
            { label: "no", nextId: "s3" },
          ],
        },
        s2: { id: "s2", type: "action" },
        s3: { id: "s3", type: "action" },
      },
    });
    const ordered = getOrderedStepIds(flow);
    expect(ordered[0]).toBe("s1");
    expect(new Set(ordered)).toEqual(new Set(["s1", "s2", "s3"]));
    expect(ordered).toHaveLength(3);
  });

  it("terminates when a step has no next or branches", () => {
    const flow = makeFlow({
      entryStepId: "only",
      steps: {
        only: { id: "only", type: "action" },
      },
    });
    expect(getOrderedStepIds(flow)).toEqual(["only"]);
    let visitCount = 0;
    walkFlow(flow, () => {
      visitCount += 1;
    });
    expect(visitCount).toBe(1);
  });

  it("does not infinite-loop when the graph contains a cycle", () => {
    const flow = makeFlow({
      entryStepId: "a",
      steps: {
        a: { id: "a", type: "action", next: "b" },
        b: { id: "b", type: "action", next: "a" },
      },
    });
    expect(getOrderedStepIds(flow)).toEqual(["a", "b"]);
    expect(getStepCount(flow)).toBe(2);
  });
});
