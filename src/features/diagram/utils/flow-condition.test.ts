import { describe, expect, it } from "vitest";
import { chain, condition, expectFlowInvariants, makeFlow } from "@/test/flow-graph-helpers";
import type { Flow, FlowStep } from "../model/flow.types";
import type { FlowEditResult } from "./flow-edit";
import { appendFlowBranch, convertFlowStepToCondition, dropFlowBranch } from "./flow-condition";
import { computeFlowStepLabels } from "./flow-labels";

const action = (id: string): FlowStep => ({ id, type: "action" });

function applied(flow: Flow, result: FlowEditResult): Flow {
  if (!result.ok) throw new Error(`expected an edit, got refusal ${result.code}: ${result.detail}`);
  return { ...flow, steps: result.steps, entryStepId: result.entryStepId };
}

const YES_NO = [
  { label: "yes", stepId: "a1" },
  { label: "no", stepId: "b1" },
];

describe("convertFlowStepToCondition", () => {
  it("turns the step into a condition whose branches each stand on a real step", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const next = applied(flow, convertFlowStepToCondition(flow, "s2", "paid?", YES_NO));
    expect(next.steps.s2.type).toBe("condition");
    expect(next.steps.s2.conditionLabel).toBe("paid?");
    expect(next.steps.s2.branches).toEqual([
      { label: "yes", nextId: "a1" },
      { label: "no", nextId: "b1" },
    ]);
    expect(next.steps.a1).toEqual({ id: "a1", type: "action" });
    expectFlowInvariants(next);
  });

  it("keeps what followed the step, as the place the branches meet again", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"));
    const next = applied(flow, convertFlowStepToCondition(flow, "s2", "paid?", YES_NO));
    expect(next.steps.a1.next).toBe("s3");
    expect(next.steps.b1.next).toBe("s3");
    expect(next.steps.s2.next).toBeUndefined();
    expect(computeFlowStepLabels(next).labels).toMatchObject({
      s1: "1",
      s2: "2",
      a1: "2a",
      b1: "2b",
      s3: "3",
    });
    expectFlowInvariants(next);
  });

  it("leaves the branches open when the step was the last one", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const next = applied(flow, convertFlowStepToCondition(flow, "s2", "paid?", YES_NO));
    expect(next.steps.a1.next).toBeUndefined();
    expect(next.steps.b1.next).toBeUndefined();
    expectFlowInvariants(next);
  });

  it("refuses a step that is already a condition", () => {
    const flow = makeFlow([condition("c", [["yes", "a"]]), action("a")]);
    expect(convertFlowStepToCondition(flow, "c", "again?", YES_NO)).toMatchObject({
      ok: false,
      code: "unknown_step",
    });
  });

  it("refuses a step that is not in the flow", () => {
    const flow = makeFlow(chain("s1"));
    expect(convertFlowStepToCondition(flow, "ghost", "paid?", YES_NO)).toMatchObject({
      ok: false,
      code: "unknown_step",
    });
  });

  it("refuses a condition with no branch at all", () => {
    const flow = makeFlow(chain("s1"));
    expect(convertFlowStepToCondition(flow, "s1", "paid?", [])).toMatchObject({
      ok: false,
      code: "invalid_branch_index",
    });
  });

  it("refuses to reuse a step id the flow already holds", () => {
    const flow = makeFlow(chain("s1", "s2"));
    expect(
      convertFlowStepToCondition(flow, "s2", "paid?", [{ label: "yes", stepId: "s1" }]),
    ).toMatchObject({ ok: false, code: "invalid_branch_index" });
  });

  it("refuses the same new step id on two branches", () => {
    const flow = makeFlow(chain("s1"));
    expect(
      convertFlowStepToCondition(flow, "s1", "paid?", [
        { label: "yes", stepId: "twin" },
        { label: "no", stepId: "twin" },
      ]),
    ).toMatchObject({ ok: false, code: "invalid_branch_index" });
  });

  it("refuses a flow that does not hold the invariants", () => {
    const flow = makeFlow([{ id: "s1", type: "action", next: "ghost" }]);
    expect(convertFlowStepToCondition(flow, "s1", "paid?", YES_NO)).toMatchObject({
      ok: false,
      code: "invalid_input",
    });
  });

  it("does not mutate the flow it is given", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const before = JSON.stringify(flow);
    convertFlowStepToCondition(flow, "s2", "paid?", YES_NO);
    expect(JSON.stringify(flow)).toBe(before);
  });
});

describe("appendFlowBranch", () => {
  it("adds the branch last, on a step of its own that ends there", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      action("a1"),
      action("b1"),
    ]);
    const next = applied(flow, appendFlowBranch(flow, "c", "maybe", "m1"));
    expect(next.steps.c.branches).toEqual([
      { label: "yes", nextId: "a1" },
      { label: "no", nextId: "b1" },
      { label: "maybe", nextId: "m1" },
    ]);
    expect(next.steps.m1).toEqual({ id: "m1", type: "action" });
    expect(computeFlowStepLabels(next).labels.m1).toBe("1c");
    expectFlowInvariants(next);
  });

  it("refuses a step that is not a condition, and says so", () => {
    const flow = makeFlow(chain("s1", "s2"));
    expect(appendFlowBranch(flow, "s1", "maybe", "m1")).toMatchObject({
      ok: false,
      code: "unknown_condition",
      detail: expect.stringContaining("is not a condition"),
    });
  });

  it("refuses a step that is not in the flow, and says that instead", () => {
    const flow = makeFlow(chain("s1"));
    expect(appendFlowBranch(flow, "ghost", "maybe", "m1")).toMatchObject({
      ok: false,
      code: "unknown_condition",
      detail: expect.stringContaining("is not a step of this flow"),
    });
  });

  it("refuses a new step id the flow already holds", () => {
    const flow = makeFlow([condition("c", [["yes", "a1"]]), action("a1")]);
    expect(appendFlowBranch(flow, "c", "maybe", "a1")).toMatchObject({
      ok: false,
      code: "invalid_branch_index",
    });
  });

  it("does not mutate the flow it is given", () => {
    const flow = makeFlow([condition("c", [["yes", "a1"]]), action("a1")]);
    const before = JSON.stringify(flow);
    appendFlowBranch(flow, "c", "maybe", "m1");
    expect(JSON.stringify(flow)).toBe(before);
  });
});

describe("dropFlowBranch", () => {
  it("removes the branch and everything only that branch reached", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "a2" },
      action("a2"),
      action("b1"),
    ]);
    const result = dropFlowBranch(flow, "c", 0);
    const next = applied(flow, result);
    expect(next.steps.c.branches).toEqual([{ label: "no", nextId: "b1" }]);
    expect(next.steps.a1).toBeUndefined();
    expect(next.steps.a2).toBeUndefined();
    if (!result.ok) throw new Error("expected an edit");
    expect(result.removedStepIds.sort()).toEqual(["a1", "a2"]);
    expectFlowInvariants(next);
  });

  it("keeps the steps the other branches also reach", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "join" },
      { id: "b1", type: "action", next: "join" },
      action("join"),
    ]);
    const result = dropFlowBranch(flow, "c", 0);
    const next = applied(flow, result);
    expect(next.steps.join).toBeDefined();
    if (!result.ok) throw new Error("expected an edit");
    expect(result.removedStepIds).toEqual(["a1"]);
    expectFlowInvariants(next);
  });

  it("turns the step back into an action when its last branch goes", () => {
    const flow = makeFlow([
      { id: "s1", type: "action", next: "c" },
      {
        id: "c",
        type: "condition",
        conditionLabel: "paid?",
        branches: [{ label: "yes", nextId: "a1" }],
      },
      action("a1"),
    ]);
    const next = applied(flow, dropFlowBranch(flow, "c", 0));
    expect(next.steps.c.branches).toBeUndefined();
    expect(next.steps.c.type).toBe("action");
    expect(next.steps.c.conditionLabel).toBeUndefined();
    expect(next.steps.a1).toBeUndefined();
    expectFlowInvariants(next);
  });

  it("refuses a branch index the condition does not have", () => {
    const flow = makeFlow([condition("c", [["yes", "a1"]]), action("a1")]);
    expect(dropFlowBranch(flow, "c", 3)).toMatchObject({ ok: false, code: "invalid_branch_index" });
    expect(dropFlowBranch(flow, "c", -1)).toMatchObject({
      ok: false,
      code: "invalid_branch_index",
    });
  });

  it("refuses a step that is not in the flow", () => {
    const flow = makeFlow(chain("s1"));
    expect(dropFlowBranch(flow, "ghost", 0)).toMatchObject({
      ok: false,
      code: "unknown_condition",
    });
  });

  it("refuses a flow that does not hold the invariants", () => {
    const flow = makeFlow([
      { id: "s1", type: "condition", branches: [{ label: "yes", nextId: "ghost" }] },
    ]);
    expect(dropFlowBranch(flow, "s1", 0)).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("does not mutate the flow it is given", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      action("a1"),
      action("b1"),
    ]);
    const before = JSON.stringify(flow);
    dropFlowBranch(flow, "c", 0);
    expect(JSON.stringify(flow)).toBe(before);
  });
});
