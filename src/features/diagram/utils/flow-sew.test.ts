import { describe, it, expect } from "vitest";
import { chain, condition, expectFlowInvariants, makeFlow } from "@/test/flow-graph-helpers";
import { sewOnDelete } from "./flow-sew";
import type { Flow } from "../model/flow.types";

/** Re-reads the result as a flow so the shared invariant checker can be applied to it. */
function sewn(flow: Flow, remove: string[]): Flow {
  const { steps, entryStepId } = sewOnDelete(flow, remove);
  return { ...flow, steps, entryStepId };
}

describe("sewOnDelete", () => {
  it("points the predecessor at the successor when a middle step goes", () => {
    const flow = makeFlow(chain("s1", "s2", "s3", "s4"), "s1");

    const result = sewOnDelete(flow, ["s2"]);

    expect(result.steps.s1!.next).toBe("s3");
    expect(result.steps.s2).toBeUndefined();
    expect(result.entryStepId).toBe("s1");
    expect(result.removedStepIds).toEqual(["s2"]);
    expect(result.blocked).toEqual([]);
    expectFlowInvariants(sewn(flow, ["s2"]));
  });

  it("makes the successor the new entry when the entry step goes", () => {
    // The record is ordered s1, s3, s2 on purpose: the new entry has to be the
    // successor of the removed entry, not whatever key happens to come first.
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s3", type: "action" },
        { id: "s2", type: "action", next: "s3" },
      ],
      "s1",
    );

    const result = sewOnDelete(flow, ["s1"]);

    expect(result.entryStepId).toBe("s2");
    expect(result.steps.s2!.next).toBe("s3");
    expectFlowInvariants(sewn(flow, ["s1"]));
  });

  it("falls back to the first remaining step when the removed entry had no successor", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action" },
        { id: "s2", type: "action" },
      ],
      "s1",
    );

    // s2 is unreachable both before and after — the fallback keeps a flow with
    // steps from ending up with no entry at all, as it did before sewing.
    expect(sewOnDelete(flow, ["s1"]).entryStepId).toBe("s2");
  });

  it("leaves the predecessor pointing at the end when the last step goes", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"), "s1");

    const result = sewOnDelete(flow, ["s3"]);

    expect(result.steps.s2!.next).toBeUndefined();
    expect("next" in result.steps.s2!).toBe(false);
    expectFlowInvariants(sewn(flow, ["s3"]));
  });

  it("sews across a run of consecutive removals", () => {
    const flow = makeFlow(chain("s1", "s2", "s3", "s4", "s5"), "s1");

    const result = sewOnDelete(flow, ["s2", "s3", "s4"]);

    expect(result.steps.s1!.next).toBe("s5");
    expect(Object.keys(result.steps)).toEqual(["s1", "s5"]);
    expectFlowInvariants(sewn(flow, ["s2", "s3", "s4"]));
  });

  it("redirects a branch whose target goes, instead of dropping the branch", () => {
    const flow = makeFlow(
      [
        condition("s1", [
          ["yes", "a0"],
          ["no", "b0"],
        ]),
        { id: "a0", type: "action", next: "a1" },
        { id: "a1", type: "action" },
        { id: "b0", type: "action" },
      ],
      "s1",
    );

    const result = sewOnDelete(flow, ["a0"]);

    expect(result.steps.s1!.branches).toEqual([
      { label: "yes", nextId: "a1" },
      { label: "no", nextId: "b0" },
    ]);
    expectFlowInvariants(sewn(flow, ["a0"]));
  });

  it("drops a branch when its target goes with nothing behind it", () => {
    const flow = makeFlow(
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

    const result = sewOnDelete(flow, ["a0"]);

    expect(result.steps.s1!.branches).toEqual([{ label: "no", nextId: "b0" }]);
  });

  it("removes the branches array entirely once its last branch is dropped", () => {
    const flow = makeFlow([condition("s1", [["only", "a0"]]), { id: "a0", type: "action" }], "s1");

    const result = sewOnDelete(flow, ["a0"]);

    expect("branches" in result.steps.s1!).toBe(false);
    expect(Object.keys(result.steps)).toEqual(["s1"]);
  });

  it("holds back the removal of a branch point instead of orphaning its branches", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        condition("s2", [
          ["yes", "a0"],
          ["no", "b0"],
        ]),
        { id: "a0", type: "action" },
        { id: "b0", type: "action" },
      ],
      "s1",
    );

    const result = sewOnDelete(flow, ["s2"]);

    expect(result.removedStepIds).toEqual([]);
    expect(result.blocked).toEqual([
      {
        code: "branch_point",
        stepId: "s2",
        branchTargetIds: ["a0", "b0"],
        detail: 'step "s2" is a branch point; removing it would orphan 2 branch(es)',
      },
    ]);
    // The graph is untouched: the branches are still attached and reachable.
    expect(result.steps).toEqual(flow.steps);
    expect(result.entryStepId).toBe("s1");
    expectFlowInvariants(sewn(flow, ["s2"]));
  });

  it("still sews the other requested removals when one is held back", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        condition("s3", [["only", "a0"]]),
        { id: "a0", type: "action" },
      ],
      "s1",
    );

    const result = sewOnDelete(flow, ["s2", "s3"]);

    expect(result.steps.s1!.next).toBe("s3");
    expect(result.removedStepIds).toEqual(["s2"]);
    expect(result.blocked.map((b) => b.stepId)).toEqual(["s3"]);
    expectFlowInvariants(sewn(flow, ["s2", "s3"]));
  });

  it("leaves a one-step flow when everything after the entry goes", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"), "s1");

    const result = sewOnDelete(flow, ["s2", "s3"]);

    expect(Object.keys(result.steps)).toEqual(["s1"]);
    expect(result.entryStepId).toBe("s1");
    expect("next" in result.steps.s1!).toBe(false);
    expectFlowInvariants(sewn(flow, ["s2", "s3"]));
  });

  it("leaves an empty flow with no entry when every step goes", () => {
    const flow = makeFlow(chain("s1", "s2"), "s1");

    const result = sewOnDelete(flow, ["s1", "s2"]);

    expect(result.steps).toEqual({});
    expect(result.entryStepId).toBeUndefined();
    expectFlowInvariants(sewn(flow, ["s1", "s2"]));
  });

  it("ignores ids that are not steps of the flow", () => {
    const flow = makeFlow(chain("s1", "s2"), "s1");

    const result = sewOnDelete(flow, ["ghost"]);

    expect(result.removedStepIds).toEqual([]);
    expect(result.steps).toEqual(flow.steps);
  });

  it("drops a reference that already pointed at nothing", () => {
    const flow = makeFlow([{ id: "s1", type: "action", next: "ghost" }], "s1");

    const result = sewOnDelete(flow, []);

    expect("next" in result.steps.s1!).toBe(false);
    expectFlowInvariants(sewn(flow, []));
  });

  it("clears an entryStepId that is not a step of the flow", () => {
    const flow = makeFlow(chain("s1"), "ghost");

    expect(sewOnDelete(flow, []).entryStepId).toBeUndefined();
  });

  it("does not loop when the removed run cycles back on itself", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        { id: "s3", type: "action", next: "s2" },
      ],
      "s1",
    );

    const result = sewOnDelete(flow, ["s2", "s3"]);

    expect(Object.keys(result.steps)).toEqual(["s1"]);
    expect("next" in result.steps.s1!).toBe(false);
    expectFlowInvariants(sewn(flow, ["s2", "s3"]));
  });

  it("does not mutate the flow it is given", () => {
    const flow = makeFlow(chain("s1", "s2", "s3"), "s1");
    const before = structuredClone(flow);

    sewOnDelete(flow, ["s2"]);

    expect(flow).toEqual(before);
  });
});
