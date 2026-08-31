import { describe, it, expect } from "vitest";
import { chain, condition, expectFlowInvariants, makeFlow } from "@/test/flow-graph-helpers";
import { checkFlowInvariants, getFlowOutEdges, getReachableStepIds } from "./flow-graph";

describe("getFlowOutEdges", () => {
  it("follows next when the step has no branches", () => {
    const flow = makeFlow(chain("s1", "s2"), "s1");

    expect(getFlowOutEdges(flow, "s1")).toEqual([{ from: "s1", to: "s2" }]);
    expect(getFlowOutEdges(flow, "s2")).toEqual([]);
  });

  it("lets a non-empty branches array shadow next, matching getNextSteps", () => {
    const flow = makeFlow(
      [
        { ...condition("s1", [["only", "b0"]]), next: "shadowed" },
        { id: "b0", type: "action" },
        { id: "shadowed", type: "action" },
      ],
      "s1",
    );

    expect(getFlowOutEdges(flow, "s1")).toEqual([{ from: "s1", to: "b0", branchIndex: 0 }]);
  });

  it("carries the declared branch index even when an earlier branch dangles", () => {
    const flow = makeFlow(
      [
        condition("s1", [
          ["a", "ghost"],
          ["b", "real"],
        ]),
        { id: "real", type: "action" },
      ],
      "s1",
    );

    expect(getFlowOutEdges(flow, "s1")).toEqual([{ from: "s1", to: "real", branchIndex: 1 }]);
  });

  it("returns nothing for an unknown step id", () => {
    expect(getFlowOutEdges(makeFlow(chain("s1"), "s1"), "nope")).toEqual([]);
  });
});

describe("getReachableStepIds", () => {
  it("walks breadth-first from the entry and stops at a cycle", () => {
    const flow = makeFlow(
      [
        condition("s1", [
          ["a", "a0"],
          ["b", "b0"],
        ]),
        { id: "a0", type: "action", next: "s1" },
        { id: "b0", type: "action" },
      ],
      "s1",
    );

    expect(getReachableStepIds(flow)).toEqual(["s1", "a0", "b0"]);
  });

  it("returns nothing when the entry step is missing from the record", () => {
    const flow = makeFlow(chain("s1", "s2"), "ghost");

    expect(getReachableStepIds(flow)).toEqual([]);
  });
});

describe("checkFlowInvariants", () => {
  it("passes a well-formed graph with branches and a reconvergence", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        condition("s2", [
          ["yes", "a0"],
          ["no", "b0"],
        ]),
        { id: "a0", type: "action", next: "join" },
        { id: "b0", type: "action", next: "join" },
        { id: "join", type: "action" },
      ],
      "s1",
    );

    expectFlowInvariants(flow);
  });

  it("passes an empty flow with no entry", () => {
    expect(checkFlowInvariants(makeFlow([], undefined, { entryStepId: undefined }))).toEqual([]);
  });

  it("reports an entry set on a flow with no steps", () => {
    const flow = makeFlow([], undefined, { entryStepId: "ghost" });

    expect(checkFlowInvariants(flow)).toEqual([
      { code: "missing_entry", detail: 'entryStepId "ghost" is set on a flow with no steps' },
    ]);
  });

  it("reports steps without an entryStepId", () => {
    const flow = makeFlow(chain("s1", "s2"), undefined, { entryStepId: undefined });

    expect(checkFlowInvariants(flow)).toEqual([
      { code: "missing_entry", detail: "flow has steps but no entryStepId" },
      expect.objectContaining({ code: "unreachable_step", stepId: "s1" }),
      expect.objectContaining({ code: "unreachable_step", stepId: "s2" }),
    ]);
  });

  it("reports an entryStepId that is not a step of the flow", () => {
    const flow = makeFlow(chain("s1"), "ghost");

    expect(checkFlowInvariants(flow)).toContainEqual({
      code: "missing_entry",
      detail: 'entryStepId "ghost" is not a step of this flow',
    });
  });

  it("reports a dangling next", () => {
    const flow = makeFlow([{ id: "s1", type: "action", next: "ghost" }], "s1");

    expect(checkFlowInvariants(flow)).toEqual([
      {
        code: "dangling_reference",
        stepId: "s1",
        targetId: "ghost",
        detail: 'step "s1" has next "ghost", which is not a step of this flow',
      },
    ]);
  });

  it("reports a dangling branch target, naming the branch", () => {
    const flow = makeFlow([condition("s1", [["maybe", "ghost"]])], "s1");

    expect(checkFlowInvariants(flow)).toEqual([
      {
        code: "dangling_reference",
        stepId: "s1",
        targetId: "ghost",
        detail: 'step "s1" branch 0 ("maybe") points at "ghost", which is not a step of this flow',
      },
    ]);
  });

  it("reports every step of an unreachable island", () => {
    const flow = makeFlow([{ id: "s1", type: "action" }, ...chain("i1", "i2")], "s1");

    expect(checkFlowInvariants(flow)).toEqual([
      expect.objectContaining({ code: "unreachable_step", stepId: "i1" }),
      expect.objectContaining({ code: "unreachable_step", stepId: "i2" }),
    ]);
  });

  it("reports a cycle by the edge that closes it", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        { id: "s3", type: "action", next: "s2" },
      ],
      "s1",
    );

    expect(checkFlowInvariants(flow)).toEqual([
      {
        code: "cycle",
        stepId: "s3",
        targetId: "s2",
        detail: 'step "s3" closes a cycle back onto "s2"',
      },
    ]);
  });

  it("reports a cycle that sits entirely inside an unreachable island", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action" },
        { id: "i1", type: "action", next: "i2" },
        { id: "i2", type: "action", next: "i1" },
      ],
      "s1",
    );

    expect(checkFlowInvariants(flow)).toContainEqual({
      code: "cycle",
      stepId: "i2",
      targetId: "i1",
      detail: 'step "i2" closes a cycle back onto "i1"',
    });
  });

  it("does not mistake a reconvergence for a cycle", () => {
    const flow = makeFlow(
      [
        condition("s1", [
          ["a", "a0"],
          ["b", "b0"],
        ]),
        { id: "a0", type: "action", next: "join" },
        { id: "b0", type: "action", next: "join" },
        { id: "join", type: "action" },
      ],
      "s1",
    );

    expect(checkFlowInvariants(flow).filter((v) => v.code === "cycle")).toEqual([]);
  });
});
