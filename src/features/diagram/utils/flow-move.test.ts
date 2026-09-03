import { describe, it, expect } from "vitest";
import { chain, condition, expectFlowInvariants, makeFlow } from "@/test/flow-graph-helpers";
import { moveStep, type MoveStepTarget } from "./flow-move";
import { computeFlowStepLabels } from "./flow-labels";
import { getOrderedStepIds } from "./flow-traversal";
import type { Flow } from "../model/flow.types";

/** Applies a move that is expected to succeed and hands back the resulting flow. */
function moved(flow: Flow, stepId: string, target: MoveStepTarget): Flow {
  const result = moveStep(flow, stepId, target);
  if (!result.ok)
    throw new Error(`expected the move to succeed, got ${result.code}: ${result.detail}`);
  const next: Flow = { ...flow, steps: result.steps, entryStepId: result.entryStepId };
  expectFlowInvariants(next);
  return next;
}

function branchingFlow(): Flow {
  return makeFlow(
    [
      { id: "s1", type: "action", next: "s2" },
      condition("s2", [
        ["yes", "a0"],
        ["no", "b0"],
      ]),
      { id: "a0", type: "action", next: "a1" },
      { id: "a1", type: "action" },
      { id: "b0", type: "action" },
    ],
    "s1",
  );
}

describe("moveStep — relinking", () => {
  it("moves a step later in the chain", () => {
    const flow = makeFlow(chain("s1", "s2", "s3", "s4", "s5"), "s1");

    const after = moved(flow, "s2", { kind: "after", stepId: "s4" });

    expect(getOrderedStepIds(after)).toEqual(["s1", "s3", "s4", "s2", "s5"]);
    expect(after.steps.s1!.next).toBe("s3");
    expect(after.steps.s4!.next).toBe("s2");
    expect(after.steps.s2!.next).toBe("s5");
  });

  it("moves a step earlier in the chain", () => {
    const flow = makeFlow(chain("s1", "s2", "s3", "s4"), "s1");

    const after = moved(flow, "s4", { kind: "before", stepId: "s2" });

    expect(getOrderedStepIds(after)).toEqual(["s1", "s4", "s2", "s3"]);
    expect(after.steps.s3!.next).toBeUndefined();
  });

  it("hands the entry to the successor when the entry step moves away", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"), "s1");

    const after = moved(flow, "s1", { kind: "after", stepId: "s3" });

    expect(after.entryStepId).toBe("s2");
    expect(getOrderedStepIds(after)).toEqual(["s2", "s3", "s1"]);
  });

  it("makes the moved step the entry when it lands before the entry", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"), "s1");

    const after = moved(flow, "s3", { kind: "before", stepId: "s1" });

    expect(after.entryStepId).toBe("s3");
    expect(getOrderedStepIds(after)).toEqual(["s3", "s1", "s2"]);
  });

  it("moves a step to the head of a branch, pushing the old head behind it", () => {
    const flow = branchingFlow();

    const after = moved(flow, "b0", { kind: "branchStart", stepId: "s2", branchIndex: 0 });

    expect(after.steps.s2!.branches).toEqual([{ label: "yes", nextId: "b0" }]);
    expect(after.steps.b0!.next).toBe("a0");
    expect(getOrderedStepIds(after)).toEqual(["s1", "s2", "b0", "a0", "a1"]);
  });

  it("drops a branch left with nothing after its only step moves out of it", () => {
    // FlowBranch requires a nextId, so a branch with no content cannot be
    // expressed — moving b0 out of branch "no" removes that branch.
    const flow = branchingFlow();

    const after = moved(flow, "b0", { kind: "after", stepId: "a1" });

    expect(after.steps.s2!.branches).toEqual([{ label: "yes", nextId: "a0" }]);
    expect(after.steps.a1!.next).toBe("b0");
  });

  it("keeps the target branch slot even when an earlier branch is dropped by the same move", () => {
    const flow = makeFlow(
      [
        condition("s1", [
          ["first", "x"],
          ["second", "y"],
        ]),
        { id: "x", type: "action" },
        { id: "y", type: "action" },
      ],
      "s1",
    );

    const after = moved(flow, "x", { kind: "branchStart", stepId: "s1", branchIndex: 1 });

    expect(after.steps.s1!.branches).toEqual([{ label: "second", nextId: "x" }]);
    expect(after.steps.x!.next).toBe("y");
  });

  it("moves a step out of a branch back onto the main path", () => {
    const flow = branchingFlow();

    const after = moved(flow, "a1", { kind: "after", stepId: "s1" });

    expect(after.steps.s1!.next).toBe("a1");
    expect(after.steps.a1!.next).toBe("s2");
    expect(after.steps.a0!.next).toBeUndefined();
    expect(after.entryStepId).toBe("s1");
  });

  it("retargets the branch when a step lands just before that branch's head", () => {
    const flow = branchingFlow();

    const after = moved(flow, "b0", { kind: "before", stepId: "a0" });

    expect(after.steps.s2!.branches).toEqual([{ label: "yes", nextId: "b0" }]);
    expect(after.steps.b0!.next).toBe("a0");
  });

  it("is an identity when a branch's only step is moved back into its own slot", () => {
    const flow = makeFlow([condition("s1", [["only", "a0"]]), { id: "a0", type: "action" }], "s1");

    const after = moved(flow, "a0", { kind: "branchStart", stepId: "s1", branchIndex: 0 });

    expect(after.steps).toEqual(flow.steps);
  });

  it("is an identity when the step is moved to where it already is", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"), "s1");

    expect(moved(flow, "s2", { kind: "after", stepId: "s1" }).steps).toEqual(flow.steps);
    expect(moved(flow, "s2", { kind: "before", stepId: "s3" }).steps).toEqual(flow.steps);
  });

  it("does not mutate the flow it is given", () => {
    const flow = branchingFlow();
    const before = structuredClone(flow);

    moveStep(flow, "b0", { kind: "after", stepId: "a1" });

    expect(flow).toEqual(before);
  });
});

describe("moveStep — refusals", () => {
  it("refuses an unknown step or target", () => {
    const flow = makeFlow(chain("s1", "s2"), "s1");

    expect(moveStep(flow, "ghost", { kind: "after", stepId: "s1" })).toMatchObject({
      ok: false,
      code: "unknown_step",
    });
    expect(moveStep(flow, "s2", { kind: "after", stepId: "ghost" })).toMatchObject({
      ok: false,
      code: "unknown_target",
    });
  });

  it("refuses to move a step relative to itself", () => {
    const flow = makeFlow(chain("s1", "s2"), "s1");

    expect(moveStep(flow, "s2", { kind: "before", stepId: "s2" })).toMatchObject({
      ok: false,
      code: "self_target",
    });
  });

  it("refuses to move a branch point rather than orphaning its branches", () => {
    const flow = branchingFlow();

    expect(moveStep(flow, "s2", { kind: "after", stepId: "a1" })).toMatchObject({
      ok: false,
      code: "branch_point_move",
    });
  });

  it("refuses 'after' a branch point, where next is shadowed", () => {
    const flow = branchingFlow();

    expect(moveStep(flow, "s1", { kind: "after", stepId: "s2" })).toMatchObject({
      ok: false,
      code: "target_after_branch_point",
    });
  });

  it("refuses a branch index that does not exist", () => {
    const flow = branchingFlow();

    expect(
      moveStep(flow, "s1", { kind: "branchStart", stepId: "s2", branchIndex: 2 }),
    ).toMatchObject({ ok: false, code: "invalid_branch_index" });
    expect(
      moveStep(flow, "s1", { kind: "branchStart", stepId: "a1", branchIndex: 0 }),
    ).toMatchObject({ ok: false, code: "invalid_branch_index" });
  });

  it("refuses to operate on a flow that does not hold the invariants", () => {
    const flow = makeFlow([{ id: "s1", type: "action" }, ...chain("island-1", "island-2")], "s1");

    const result = moveStep(flow, "island-1", { kind: "after", stepId: "s1" });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.ok === false && result.violations).toEqual([
      expect.objectContaining({ code: "unreachable_step", stepId: "island-1" }),
      expect.objectContaining({ code: "unreachable_step", stepId: "island-2" }),
    ]);
  });
});

describe("moveStep — what it does to the numbering", () => {
  it("renumbers the main path when a middle step changes place", () => {
    const flow = makeFlow(chain("s1", "s2", "s3", "s4"), "s1");
    expect(computeFlowStepLabels(flow).labels).toEqual({ s1: "1", s2: "2", s3: "3", s4: "4" });

    const after = moved(flow, "s2", { kind: "after", stepId: "s4" });

    expect(computeFlowStepLabels(after).labels).toEqual({ s1: "1", s3: "2", s4: "3", s2: "4" });
  });

  it("changes a step's label from a main-path number to a branch letter", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        condition("s3", [["yes", "a0"]]),
        { id: "a0", type: "action" },
      ],
      "s1",
    );
    expect(computeFlowStepLabels(flow).labels).toEqual({
      s1: "1",
      s2: "2",
      s3: "3",
      a0: "3a",
    });

    const after = moved(flow, "s2", { kind: "branchStart", stepId: "s3", branchIndex: 0 });

    expect(computeFlowStepLabels(after).labels).toEqual({
      s1: "1",
      s3: "2",
      s2: "2a",
      a0: "2a.1",
    });
  });

  it("swaps the branch letters when the branches array is reordered", () => {
    const before = makeFlow(
      [
        condition("s1", [
          ["yes", "a0"],
          ["no", "b0"],
        ]),
        { id: "a0", type: "action" },
        { id: "b0", type: "action" },
      ],
      "s1",
    );
    const after = makeFlow(
      [
        condition("s1", [
          ["no", "b0"],
          ["yes", "a0"],
        ]),
        { id: "a0", type: "action" },
        { id: "b0", type: "action" },
      ],
      "s1",
    );

    expect(computeFlowStepLabels(before).labels).toMatchObject({ a0: "1a", b0: "1b" });
    expect(computeFlowStepLabels(after).labels).toMatchObject({ b0: "1a", a0: "1b" });
  });

  it("keeps a reconvergence numbered after its branch point when a branch step moves", () => {
    const flow = makeFlow(
      [
        condition("s1", [
          ["yes", "a0"],
          ["no", "b0"],
        ]),
        { id: "a0", type: "action", next: "a1" },
        { id: "a1", type: "action", next: "join" },
        { id: "b0", type: "action", next: "join" },
        { id: "join", type: "action" },
      ],
      "s1",
    );
    expect(computeFlowStepLabels(flow).labels).toEqual({
      s1: "1",
      a0: "1a",
      a1: "1a.1",
      b0: "1b",
      join: "2",
    });

    const after = moved(flow, "a1", { kind: "branchStart", stepId: "s1", branchIndex: 1 });

    expect(computeFlowStepLabels(after).labels).toEqual({
      s1: "1",
      a0: "1a",
      a1: "1b",
      b0: "1b.1",
      join: "2",
    });
  });
});
