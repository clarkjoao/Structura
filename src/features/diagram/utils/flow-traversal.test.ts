import { describe, expect, it } from "vitest";
import type { Flow } from "../model/flow.types";
import { canReachStep, getOrderedStepIds, getStepCount, walkFlow } from "./flow-traversal";

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

/**
 * What lies ahead of a step, which is not what lies behind it.
 *
 * `getPathToStep` walks from the entry and answers "how did the reading get
 * here". Claims about what happens *after* a step need the other direction: a
 * call answered inside one branch is not answered on the other, and a panel
 * that cannot tell the difference states as certain something the reader's
 * branch never reaches.
 */
describe("whether one step can reach another", () => {
  const BRANCHED = makeFlow({
    entryStepId: "s1",
    steps: {
      s1: { id: "s1", type: "action", next: "c" },
      c: {
        id: "c",
        type: "condition",
        branches: [
          { label: "sim", nextId: "a1" },
          { label: "nao", nextId: "b1" },
        ],
      },
      a1: { id: "a1", type: "action", next: "join" },
      b1: { id: "b1", type: "action", next: "join" },
      join: { id: "join", type: "action" },
    },
  });

  it("finds a step further down the same run", () => {
    expect(canReachStep(BRANCHED, "s1", "join")).toBe(true);
  });

  it("finds a step in either branch from the point that chooses", () => {
    expect(canReachStep(BRANCHED, "c", "a1")).toBe(true);
    expect(canReachStep(BRANCHED, "c", "b1")).toBe(true);
  });

  it("does not find a step in the branch not taken", () => {
    expect(canReachStep(BRANCHED, "a1", "b1")).toBe(false);
    expect(canReachStep(BRANCHED, "b1", "a1")).toBe(false);
  });

  it("does not look backwards", () => {
    expect(canReachStep(BRANCHED, "join", "s1")).toBe(false);
  });

  it("says a plain step does not reach itself", () => {
    expect(canReachStep(BRANCHED, "join", "join")).toBe(false);
  });

  it("says a step in a cycle does reach itself, and terminates", () => {
    const loop = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", next: "s2" },
        s2: { id: "s2", type: "action", next: "s1" },
      },
    });

    expect(canReachStep(loop, "s1", "s1")).toBe(true);
  });

  it("answers for steps that are not there", () => {
    expect(canReachStep(BRANCHED, "s1", "ghost")).toBe(false);
    expect(canReachStep(BRANCHED, "ghost", "s1")).toBe(false);
  });
});
