import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { describeFlowProgress } from "./flowState";

/**
 * The counter under a reading that took a branch.
 *
 * The denominator used to be every step in the script, so a four-step reading
 * of a five-step flow ended at "4 / 5"; and the numerator was the step's place
 * in a depth-first listing, so the same reading could read "5 / 5" in the
 * middle. Both numbers are about the path now.
 */

function flow(steps: Record<string, FlowStep>, entryStepId = "s1"): Flow {
  return { id: "f1", name: "F", mermaid: "", diagramId: "d1", steps, entryStepId };
}

/** s1 → s2 → s3, nothing to choose. */
const LINEAR = flow({
  s1: { id: "s1", type: "action", next: "s2" },
  s2: { id: "s2", type: "action", next: "s3" },
  s3: { id: "s3", type: "action" },
});

/** s1 → c → {a | b} → join. Five steps; every reading is four. */
const BRANCHED = flow({
  s1: { id: "s1", type: "action", next: "c" },
  c: {
    id: "c",
    type: "condition",
    conditionLabel: "ok?",
    branches: [
      { label: "yes", nextId: "a" },
      { label: "no", nextId: "b" },
    ],
  },
  a: { id: "a", type: "action", next: "join" },
  b: { id: "b", type: "action", next: "join" },
  join: { id: "join", type: "action" },
});

/** The "no" side is two steps longer, so the floor and the outcome differ. */
const LOPSIDED = flow({
  s1: { id: "s1", type: "action", next: "c" },
  c: {
    id: "c",
    type: "condition",
    conditionLabel: "ok?",
    branches: [
      { label: "yes", nextId: "a" },
      { label: "no", nextId: "b1" },
    ],
  },
  a: { id: "a", type: "action" },
  b1: { id: "b1", type: "action", next: "b2" },
  b2: { id: "b2", type: "action", next: "b3" },
  b3: { id: "b3", type: "action" },
});

describe("a linear reading counts exactly as it always did", () => {
  it("starts at one of three", () => {
    expect(describeFlowProgress(LINEAR, "s1", [])).toEqual({
      position: 1,
      pathTotal: 3,
      openEnded: false,
      flowTotal: 3,
    });
  });

  it("ends at three of three", () => {
    expect(describeFlowProgress(LINEAR, "s3", ["s1", "s2"])).toEqual({
      position: 3,
      pathTotal: 3,
      openEnded: false,
      flowTotal: 3,
    });
  });

  it("keeps the path total and the script total the same number throughout", () => {
    for (const [id, history] of [
      ["s1", []],
      ["s2", ["s1"]],
      ["s3", ["s1", "s2"]],
    ] as const) {
      const p = describeFlowProgress(LINEAR, id, history);
      expect([id, p.pathTotal]).toEqual([id, p.flowTotal]);
    }
  });
});

describe("a reading that takes a branch is counted along the path", () => {
  it("ends at four of four, not four of five", () => {
    expect(describeFlowProgress(BRANCHED, "join", ["s1", "c", "b"])).toEqual({
      position: 4,
      pathTotal: 4,
      openEnded: false,
      flowTotal: 5,
    });
  });

  it("never overshoots the total on the way, whichever branch was taken", () => {
    const onB = describeFlowProgress(BRANCHED, "b", ["s1", "c"]);
    expect(onB.position).toBe(3);
    expect(onB.position).toBeLessThanOrEqual(onB.pathTotal);
  });

  it("counts the branch that was taken, not the one that was not", () => {
    const short = describeFlowProgress(LOPSIDED, "a", ["s1", "c"]);
    const long = describeFlowProgress(LOPSIDED, "b1", ["s1", "c"]);
    expect([short.pathTotal, long.pathTotal]).toEqual([3, 5]);
  });

  it("keeps the script's own total alongside, for the reader who wants it", () => {
    expect(describeFlowProgress(BRANCHED, "s1", []).flowTotal).toBe(5);
  });

  it("says the total is still open while a choice is ahead", () => {
    expect(describeFlowProgress(BRANCHED, "s1", []).openEnded).toBe(true);
    expect(describeFlowProgress(BRANCHED, "c", ["s1"]).openEnded).toBe(true);
  });

  it("closes the total once the choice is behind", () => {
    expect(describeFlowProgress(BRANCHED, "a", ["s1", "c"]).openEnded).toBe(false);
  });

  it("offers the shortest way out as the floor, never a guess at the longest", () => {
    // From s1 the short side ends in 3 steps and the long one in 5.
    expect(describeFlowProgress(LOPSIDED, "s1", [])).toEqual({
      position: 1,
      pathTotal: 3,
      openEnded: true,
      flowTotal: 6,
    });
  });

  it("settles on the real total once the longer branch is taken", () => {
    expect(describeFlowProgress(LOPSIDED, "b1", ["s1", "c"])).toEqual({
      position: 3,
      pathTotal: 5,
      openEnded: false,
      flowTotal: 6,
    });
  });
});

describe("the counter holds up on a script that is not a tidy chain", () => {
  it("reports nothing walked when there is no step in hand", () => {
    expect(describeFlowProgress(LINEAR, null, [])).toEqual({
      position: 0,
      pathTotal: 3,
      openEnded: false,
      flowTotal: 3,
    });
  });

  it("does the same for a step id the script does not have", () => {
    expect(describeFlowProgress(LINEAR, "ghost", ["s1"]).position).toBe(0);
  });

  it("terminates on a script that loops back on itself", () => {
    const loop = flow({
      s1: { id: "s1", type: "action", next: "s2" },
      s2: { id: "s2", type: "action", next: "s1" },
    });
    expect(describeFlowProgress(loop, "s1", []).pathTotal).toBeGreaterThanOrEqual(1);
  });

  it("counts a one-step script as one of one", () => {
    const single = flow({ s1: { id: "s1", type: "action" } });
    expect(describeFlowProgress(single, "s1", [])).toEqual({
      position: 1,
      pathTotal: 1,
      openEnded: false,
      flowTotal: 1,
    });
  });
});
