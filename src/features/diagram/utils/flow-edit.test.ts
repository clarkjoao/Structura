import { describe, expect, it } from "vitest";
import { chain, condition, expectFlowInvariants, makeFlow } from "@/test/flow-graph-helpers";
import type { FlowStep } from "../model/flow.types";
import {
  appendFlowStep,
  getFlowTail,
  getOpenEndIds,
  insertFlowStep,
  isPlaceholderStep,
} from "./flow-edit";
import { computeFlowStepLabels } from "./flow-labels";

const action = (id: string): FlowStep => ({ id, type: "action" });

/** Applies a successful edit back onto the flow so the next assertion sees a whole flow. */
function applied(flow: ReturnType<typeof makeFlow>, result: ReturnType<typeof appendFlowStep>) {
  if (!result.ok) throw new Error(`expected an edit, got refusal ${result.code}: ${result.detail}`);
  return { ...flow, steps: result.steps, entryStepId: result.entryStepId };
}

describe("getFlowTail", () => {
  it("returns the last step of the main sequence", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"));
    expect(getFlowTail(flow, { kind: "trunk" })).toBe("s3");
  });

  it("returns undefined when the flow has steps but no entry step", () => {
    const flow = makeFlow(chain("s1", "s2"), undefined, { entryStepId: undefined });
    expect(getFlowTail(flow, { kind: "trunk" })).toBeUndefined();
  });

  it("stops the main sequence at a condition nothing comes back from", () => {
    const flow = makeFlow([
      { id: "s1", type: "action", next: "c" },
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      action("a1"),
      action("b1"),
    ]);
    expect(getFlowTail(flow, { kind: "trunk" })).toBe("c");
  });

  it("carries the main sequence past the point where the branches meet again", () => {
    const flow = makeFlow([
      { id: "s1", type: "action", next: "c" },
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "join" },
      { id: "b1", type: "action", next: "join" },
      action("join"),
    ]);
    expect(computeFlowStepLabels(flow).labels.join).toBe("3");
    expect(getFlowTail(flow, { kind: "trunk" })).toBe("join");
  });

  it("returns the last step of the branch the cursor points at", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "a2" },
      action("a2"),
      action("b1"),
    ]);
    expect(getFlowTail(flow, { kind: "branch", conditionStepId: "c", branchIndex: 0 })).toBe("a2");
    expect(getFlowTail(flow, { kind: "branch", conditionStepId: "c", branchIndex: 1 })).toBe("b1");
  });

  it("does not mistake a deeper branch for the branch it was asked about", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "inner" },
      condition("inner", [["deep", "d1"]]),
      action("d1"),
      action("b1"),
    ]);
    // a1 is "1a", inner is "1a.2", d1 is "1a.2a" — the branch's own sequence ends at inner.
    expect(getFlowTail(flow, { kind: "branch", conditionStepId: "c", branchIndex: 0 })).toBe(
      "inner",
    );
  });

  it("returns undefined when the condition the cursor names is not reachable", () => {
    const flow = makeFlow([action("s1"), condition("orphan", [["yes", "x"]]), action("x")], "s1");
    expect(
      getFlowTail(flow, { kind: "branch", conditionStepId: "orphan", branchIndex: 0 }),
    ).toBeUndefined();
  });

  it("tells the 27th branch apart from the first branch of the first branch", () => {
    const branches: [string, string][] = [];
    const steps: FlowStep[] = [];
    for (let i = 0; i < 27; i++) {
      branches.push([`b${i}`, `t${i}`]);
      steps.push(action(`t${i}`));
    }
    const flow = makeFlow([condition("c", branches), ...steps]);
    expect(computeFlowStepLabels(flow).labels.t26).toBe("1aa");
    expect(getFlowTail(flow, { kind: "branch", conditionStepId: "c", branchIndex: 26 })).toBe(
      "t26",
    );
    expect(getFlowTail(flow, { kind: "branch", conditionStepId: "c", branchIndex: 0 })).toBe("t0");
  });
});

describe("getOpenEndIds", () => {
  it("returns the end of a chain", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"));
    expect(getOpenEndIds(flow, "s1")).toEqual(["s3"]);
  });

  it("returns the anchor itself when it has nowhere to go", () => {
    const flow = makeFlow(chain("s1", "s2"));
    expect(getOpenEndIds(flow, "s2")).toEqual(["s2"]);
  });

  it("returns every branch tail below a condition", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "a2" },
      action("a2"),
      action("b1"),
    ]);
    expect(getOpenEndIds(flow, "c").sort()).toEqual(["a2", "b1"]);
  });

  it("returns nothing for a step that is not in the flow", () => {
    const flow = makeFlow(chain("s1", "s2"));
    expect(getOpenEndIds(flow, "nope")).toEqual([]);
  });
});

describe("appendFlowStep", () => {
  it("hangs the step off the end of the main sequence", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const next = applied(flow, appendFlowStep(flow, action("s3"), { kind: "trunk" }));
    expect(next.steps.s2.next).toBe("s3");
    expect(next.entryStepId).toBe("s1");
    expectFlowInvariants(next);
  });

  it("makes the first step of an empty flow its entry", () => {
    const flow = makeFlow([], undefined, { entryStepId: undefined });
    const next = applied(flow, appendFlowStep(flow, action("s1"), { kind: "trunk" }));
    expect(next.entryStepId).toBe("s1");
    expectFlowInvariants(next);
  });

  it("brings the branches back together when the main sequence continues after a condition", () => {
    const flow = makeFlow([
      { id: "s1", type: "action", next: "c" },
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      action("a1"),
      action("b1"),
    ]);
    const next = applied(flow, appendFlowStep(flow, action("d"), { kind: "trunk" }));
    expect(next.steps.a1.next).toBe("d");
    expect(next.steps.b1.next).toBe("d");
    expect(next.steps.c.next).toBeUndefined();
    expect(computeFlowStepLabels(next).labels).toMatchObject({
      s1: "1",
      c: "2",
      a1: "2a",
      b1: "2b",
      d: "3",
    });
    expectFlowInvariants(next);
  });

  it("reaches the open ends of a nested condition too", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "inner" },
      condition("inner", [
        ["l", "l1"],
        ["r", "r1"],
      ]),
      action("l1"),
      action("r1"),
      action("b1"),
    ]);
    const next = applied(flow, appendFlowStep(flow, action("d"), { kind: "trunk" }));
    expect(next.steps.l1.next).toBe("d");
    expect(next.steps.r1.next).toBe("d");
    expect(next.steps.b1.next).toBe("d");
    expectFlowInvariants(next);
  });

  it("hangs the step off the end of the branch the cursor points at", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      action("a1"),
      action("b1"),
    ]);
    const next = applied(
      flow,
      appendFlowStep(flow, action("a2"), { kind: "branch", conditionStepId: "c", branchIndex: 0 }),
    );
    expect(next.steps.a1.next).toBe("a2");
    expect(next.steps.b1.next).toBeUndefined();
    expectFlowInvariants(next);
  });

  it("refuses a step id the flow already uses", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const result = appendFlowStep(flow, action("s2"), { kind: "trunk" });
    expect(result).toMatchObject({ ok: false, code: "duplicate_step_id" });
  });

  it("refuses a flow that does not hold the invariants", () => {
    const flow = makeFlow([{ id: "s1", type: "action", next: "ghost" }]);
    const result = appendFlowStep(flow, action("s2"), { kind: "trunk" });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    if (result.ok) throw new Error("expected a refusal");
    expect(result.violations).toEqual([
      { code: "dangling_reference", stepId: "s1", targetId: "ghost", detail: expect.any(String) },
    ]);
  });

  it("refuses a cursor whose condition is not a step of the flow", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const result = appendFlowStep(flow, action("s3"), {
      kind: "branch",
      conditionStepId: "ghost",
      branchIndex: 0,
    });
    expect(result).toMatchObject({ ok: false, code: "unknown_condition" });
  });

  it("refuses a branch index the condition does not have", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      action("a1"),
      action("b1"),
    ]);
    for (const branchIndex of [2, 7, -1]) {
      expect(
        appendFlowStep(flow, action("s3"), { kind: "branch", conditionStepId: "c", branchIndex }),
      ).toMatchObject({ ok: false, code: "invalid_branch_index" });
    }
  });

  it("refuses a branch with no sequence of its own to append to", () => {
    // Both branches land on the same step, so neither has a "1a" of its own.
    const flow = makeFlow([
      condition("c", [
        ["yes", "shared"],
        ["no", "shared"],
      ]),
      action("shared"),
    ]);
    const result = appendFlowStep(flow, action("x"), {
      kind: "branch",
      conditionStepId: "c",
      branchIndex: 0,
    });
    expect(result).toMatchObject({ ok: false, code: "unlabeled_cursor" });
  });

  it("does not mutate the flow it is given", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const before = JSON.stringify(flow);
    appendFlowStep(flow, action("s3"), { kind: "trunk" });
    expect(JSON.stringify(flow)).toBe(before);
  });
});

describe("insertFlowStep", () => {
  it("puts the step in front of its target", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"));
    const next = applied(
      flow,
      insertFlowStep(flow, action("new"), { kind: "before", stepId: "s2" }),
    );
    expect(next.steps.s1.next).toBe("new");
    expect(next.steps.new.next).toBe("s2");
    expectFlowInvariants(next);
  });

  it("takes over the entry when it is inserted in front of it", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const next = applied(
      flow,
      insertFlowStep(flow, action("new"), { kind: "before", stepId: "s1" }),
    );
    expect(next.entryStepId).toBe("new");
    expect(next.steps.new.next).toBe("s1");
    expectFlowInvariants(next);
  });

  it("redirects the branch that pointed at its target", () => {
    const flow = makeFlow([condition("c", [["yes", "a1"]]), action("a1")]);
    const next = applied(
      flow,
      insertFlowStep(flow, action("new"), { kind: "before", stepId: "a1" }),
    );
    expect(next.steps.c.branches).toEqual([{ label: "yes", nextId: "new" }]);
    expect(next.steps.new.next).toBe("a1");
    expectFlowInvariants(next);
  });

  it("puts the step behind its target and keeps what followed", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"));
    const next = applied(
      flow,
      insertFlowStep(flow, action("new"), { kind: "after", stepId: "s1" }),
    );
    expect(next.steps.s1.next).toBe("new");
    expect(next.steps.new.next).toBe("s2");
    expectFlowInvariants(next);
  });

  it("leaves the inserted step at the end when its target had no successor", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const next = applied(
      flow,
      insertFlowStep(flow, action("new"), { kind: "after", stepId: "s2" }),
    );
    expect(next.steps.new.next).toBeUndefined();
    expectFlowInvariants(next);
  });

  it("refuses to insert after a branch point", () => {
    const flow = makeFlow([condition("c", [["yes", "a1"]]), action("a1")]);
    const result = insertFlowStep(flow, action("new"), { kind: "after", stepId: "c" });
    expect(result).toMatchObject({ ok: false, code: "target_after_branch_point" });
  });

  it("puts the step at the head of a branch", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      action("a1"),
      action("b1"),
    ]);
    const next = applied(
      flow,
      insertFlowStep(flow, action("new"), { kind: "branchStart", stepId: "c", branchIndex: 1 }),
    );
    expect(next.steps.c.branches).toEqual([
      { label: "yes", nextId: "a1" },
      { label: "no", nextId: "new" },
    ]);
    expect(next.steps.new.next).toBe("b1");
    expectFlowInvariants(next);
  });

  it("refuses a branch index the condition does not have", () => {
    const flow = makeFlow([condition("c", [["yes", "a1"]]), action("a1")]);
    const result = insertFlowStep(flow, action("new"), {
      kind: "branchStart",
      stepId: "c",
      branchIndex: 2,
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_branch_index" });
  });

  it("refuses a target that is not a step of the flow", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const result = insertFlowStep(flow, action("new"), { kind: "after", stepId: "ghost" });
    expect(result).toMatchObject({ ok: false, code: "unknown_step" });
  });

  it("refuses a step id the flow already uses", () => {
    const flow = makeFlow(chain("s1", "s2"));
    const result = insertFlowStep(flow, action("s1"), { kind: "after", stepId: "s2" });
    expect(result).toMatchObject({ ok: false, code: "duplicate_step_id" });
  });

  it("refuses a flow that does not hold the invariants", () => {
    const flow = makeFlow([{ id: "s1", type: "action", next: "ghost" }]);
    const result = insertFlowStep(flow, action("new"), { kind: "after", stepId: "s1" });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("refuses a step that arrives already pointing back into the flow", () => {
    // The caller hands over a step with a `next` of its own; behind the last
    // step that closes a loop, which the final invariant check is there to see.
    const flow = makeFlow(chain("s1", "s2"));
    const result = insertFlowStep(
      flow,
      { id: "new", type: "action", next: "s1" },
      { kind: "after", stepId: "s2" },
    );
    expect(result).toMatchObject({ ok: false, code: "invariant_violated" });
    if (result.ok) throw new Error("expected a refusal");
    expect(result.violations?.map((violation) => violation.code)).toContain("cycle");
  });

  it("does not mutate the flow it is given", () => {
    const flow = makeFlow([condition("c", [["yes", "a1"]]), action("a1")]);
    const before = JSON.stringify(flow);
    insertFlowStep(flow, action("new"), { kind: "branchStart", stepId: "c", branchIndex: 0 });
    expect(JSON.stringify(flow)).toBe(before);
  });
});

describe("isPlaceholderStep", () => {
  it("is true for a step the recorder created and nothing filled in", () => {
    expect(isPlaceholderStep({ id: "s1", type: "action" })).toBe(true);
  });

  it("is false once the step points at something on the canvas", () => {
    expect(isPlaceholderStep({ id: "s1", type: "action", componentId: "c1" })).toBe(false);
    expect(isPlaceholderStep({ id: "s1", type: "action", connectionId: "e1" })).toBe(false);
  });

  it("is false once the step carries words of its own", () => {
    expect(isPlaceholderStep({ id: "s1", type: "action", description: "charges the card" })).toBe(
      false,
    );
    expect(isPlaceholderStep({ id: "s1", type: "action", description: "   " })).toBe(true);
  });

  it("is false for a condition", () => {
    expect(isPlaceholderStep({ id: "s1", type: "condition" })).toBe(false);
  });
});
