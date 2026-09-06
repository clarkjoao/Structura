import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "../model/flow.types";
import { getPathToStep } from "./flow-traversal";

/**
 * What ran before a step, which is what the script panel needs to show the
 * state as it stands where someone is editing.
 *
 * The same question the reading answers with `history`, asked of a step nobody
 * has walked to yet.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Checkout", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

const LINEAR = flow({
  s1: { next: "s2" },
  s2: { next: "s3" },
  s3: {},
});

const FORKED = flow({
  s1: { next: "c" },
  c: {
    type: "condition",
    branches: [
      { label: "sim", nextId: "a1" },
      { label: "não", nextId: "b1" },
    ],
  },
  a1: { next: "join" },
  b1: { next: "join" },
  join: {},
});

describe("the path a reading takes to reach a step", () => {
  it("is everything before it, and the step itself", () => {
    expect(getPathToStep(LINEAR, "s3")).toEqual(["s1", "s2", "s3"]);
  });

  it("is just the entry when the entry is the step", () => {
    expect(getPathToStep(LINEAR, "s1")).toEqual(["s1"]);
  });

  it("goes through the branch that leads to a step inside one", () => {
    expect(getPathToStep(FORKED, "b1")).toEqual(["s1", "c", "b1"]);
  });

  it("takes the first way in for a step both branches reach", () => {
    expect(getPathToStep(FORKED, "join")).toEqual(["s1", "c", "a1", "join"]);
  });

  it("is empty for a step nothing leads to, which is what runs before it", () => {
    const orphaned = flow({ s1: {}, loose: {} });

    expect(getPathToStep(orphaned, "loose")).toEqual([]);
  });

  it("is empty for a step that is not in the flow at all", () => {
    expect(getPathToStep(LINEAR, "nope")).toEqual([]);
  });

  it("comes back from a cycle instead of walking it forever", () => {
    const looping = flow({ s1: { next: "s2" }, s2: { next: "s1" }, s3: {} });

    expect(getPathToStep(looping, "s2")).toEqual(["s1", "s2"]);
    expect(getPathToStep(looping, "s3")).toEqual([]);
  });
});
