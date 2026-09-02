import { describe, expect, it } from "vitest";
import { chain, condition, makeFlow } from "@/test/flow-graph-helpers";
import type { FlowStep } from "../model/flow.types";
import {
  buildFlowOutline,
  flowBranchHeadLabel,
  flowLabelDepth,
  getBranchRows,
} from "./flow-outline";

const action = (id: string): FlowStep => ({ id, type: "action" });

/** 1 → c(2) with branches yes/no, both meeting again at 3. */
function branchedFlow() {
  // Written down in a deliberately different order from the reading order, so
  // a test about the reading order cannot pass on the record order.
  return makeFlow(
    [
      action("join"),
      { id: "b1", type: "action", next: "join" },
      { id: "a2", type: "action", next: "join" },
      { id: "a1", type: "action", next: "a2" },
      {
        id: "c",
        type: "condition",
        conditionLabel: "paid?",
        branches: [
          { label: "yes", nextId: "a1" },
          { label: "no", nextId: "b1" },
        ],
      },
      { id: "s1", type: "action", next: "c" },
    ],
    "s1",
  );
}

describe("flowLabelDepth", () => {
  it("counts one level per lettered segment", () => {
    expect(flowLabelDepth("3")).toBe(0);
    expect(flowLabelDepth("3a")).toBe(1);
    expect(flowLabelDepth("3a.1")).toBe(1);
    expect(flowLabelDepth("3a.2b")).toBe(2);
    expect(flowLabelDepth("3a.2b.1")).toBe(2);
  });
});

describe("flowBranchHeadLabel", () => {
  it("stops at the last lettered segment", () => {
    expect(flowBranchHeadLabel("3")).toBeUndefined();
    expect(flowBranchHeadLabel("3a")).toBe("3a");
    expect(flowBranchHeadLabel("3a.2")).toBe("3a");
    expect(flowBranchHeadLabel("3a.2b")).toBe("3a.2b");
    expect(flowBranchHeadLabel("3a.2b.1")).toBe("3a.2b");
  });
});

describe("buildFlowOutline", () => {
  it("puts the rows in reading order", () => {
    const outline = buildFlowOutline(branchedFlow());
    expect(outline.rows.map((row) => row.label)).toEqual(["1", "2", "2a", "2a.1", "2b", "3"]);
    expect(outline.rows.map((row) => row.stepId)).toEqual(["s1", "c", "a1", "a2", "b1", "join"]);
  });

  it("indents the branches and brings the meeting point back out", () => {
    const outline = buildFlowOutline(branchedFlow());
    expect(outline.rows.map((row) => row.depth)).toEqual([0, 0, 1, 1, 1, 0]);
  });

  it("names the branch each row sits in", () => {
    const outline = buildFlowOutline(branchedFlow());
    const byStep = Object.fromEntries(outline.rows.map((row) => [row.stepId, row.branch]));
    expect(byStep.s1).toBeUndefined();
    expect(byStep.join).toBeUndefined();
    expect(byStep.a1).toEqual({ conditionStepId: "c", branchIndex: 0, label: "yes" });
    expect(byStep.a2).toEqual({ conditionStepId: "c", branchIndex: 0, label: "yes" });
    expect(byStep.b1).toEqual({ conditionStepId: "c", branchIndex: 1, label: "no" });
  });

  it("marks the branch point and the head of each branch", () => {
    const outline = buildFlowOutline(branchedFlow());
    const branchPoints = outline.rows.filter((row) => row.isBranchPoint).map((row) => row.stepId);
    const heads = outline.rows.filter((row) => row.isBranchHead).map((row) => row.stepId);
    expect(branchPoints).toEqual(["c"]);
    expect(heads).toEqual(["a1", "b1"]);
  });

  it("keeps a nested branch under its own condition", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "inner" },
      {
        id: "inner",
        type: "condition",
        branches: [
          { label: "left", nextId: "l1" },
          { label: "right", nextId: "r1" },
        ],
      },
      action("l1"),
      action("r1"),
      action("b1"),
    ]);
    const outline = buildFlowOutline(flow);
    const byStep = Object.fromEntries(outline.rows.map((row) => [row.stepId, row]));
    expect(byStep.inner!.label).toBe("1a.1");
    expect(byStep.l1!.label).toBe("1a.1a");
    expect(byStep.l1!.depth).toBe(2);
    expect(byStep.l1!.branch).toEqual({ conditionStepId: "inner", branchIndex: 0, label: "left" });
    expect(byStep.b1!.depth).toBe(1);
  });

  it("reports the steps the numbering could not reach instead of hiding them", () => {
    const flow = makeFlow([...chain("s1", "s2"), action("lost")], "s1");
    const outline = buildFlowOutline(flow);
    expect(outline.rows.map((row) => row.stepId)).toEqual(["s1", "s2"]);
    expect(outline.unreachable).toEqual(["lost"]);
  });

  it("is empty for a flow with no entry step", () => {
    const flow = makeFlow(chain("s1", "s2"), undefined, { entryStepId: undefined });
    const outline = buildFlowOutline(flow);
    expect(outline.rows).toEqual([]);
    expect(outline.unreachable).toEqual(["s1", "s2"]);
  });

  it("says nothing is ambiguous when the branches meet at one place", () => {
    const outline = buildFlowOutline(branchedFlow());
    expect(outline.ambiguities).toEqual([]);
    expect(outline.collisions).toEqual([]);
  });

  it("passes the numbering's own complaints straight through", () => {
    // Two branches meet again at 3; the third skips it and arrives straight at
    // the step after. The two incoming chains close at different places of the
    // main sequence, which the numbering reports rather than hides.
    const flow = makeFlow([
      { id: "s1", type: "action", next: "c" },
      {
        id: "c",
        type: "condition",
        branches: [
          { label: "yes", nextId: "a1" },
          { label: "no", nextId: "b1" },
          { label: "later", nextId: "m1" },
        ],
      },
      { id: "a1", type: "action", next: "join" },
      { id: "b1", type: "action", next: "join" },
      { id: "join", type: "action", next: "tail" },
      { id: "m1", type: "action", next: "tail" },
      action("tail"),
    ]);
    const outline = buildFlowOutline(flow);
    expect(outline.ambiguities).toEqual([
      { stepId: "tail", closingLabels: ["2", "3"], chosenLabel: "4" },
    ]);
  });

  it("leaves a branch whose target is missing out of the rows", () => {
    const flow = makeFlow([
      { id: "s1", type: "action", next: "c" },
      {
        id: "c",
        type: "condition",
        branches: [
          { label: "yes", nextId: "a1" },
          { label: "gone", nextId: "ghost" },
        ],
      },
      action("a1"),
    ]);
    const outline = buildFlowOutline(flow);
    expect(outline.rows.map((row) => row.stepId)).toEqual(["s1", "c", "a1"]);
    const a1 = outline.rows.find((row) => row.stepId === "a1")!;
    expect(a1.branch).toEqual({ conditionStepId: "c", branchIndex: 0, label: "yes" });
  });
});

describe("getBranchRows", () => {
  it("returns the branch's own rows and nothing after them", () => {
    const outline = buildFlowOutline(branchedFlow());
    expect(getBranchRows(outline, "c", 0).map((row) => row.stepId)).toEqual(["a1", "a2"]);
    expect(getBranchRows(outline, "c", 1).map((row) => row.stepId)).toEqual(["b1"]);
  });

  it("leaves the step where the branches meet again out of both of them", () => {
    const outline = buildFlowOutline(branchedFlow());
    for (const branchIndex of [0, 1]) {
      expect(getBranchRows(outline, "c", branchIndex).map((row) => row.stepId)).not.toContain(
        "join",
      );
    }
  });

  it("takes a nested branch along with the branch that holds it", () => {
    const flow = makeFlow([
      condition("c", [
        ["yes", "a1"],
        ["no", "b1"],
      ]),
      { id: "a1", type: "action", next: "inner" },
      {
        id: "inner",
        type: "condition",
        branches: [
          { label: "left", nextId: "l1" },
          { label: "right", nextId: "r1" },
        ],
      },
      action("l1"),
      action("r1"),
      action("b1"),
    ]);
    const outline = buildFlowOutline(flow);
    expect(getBranchRows(outline, "c", 0).map((row) => row.stepId)).toEqual([
      "a1",
      "inner",
      "l1",
      "r1",
    ]);
    expect(getBranchRows(outline, "inner", 1).map((row) => row.stepId)).toEqual(["r1"]);
  });

  it("returns nothing for a branch that is not there", () => {
    const outline = buildFlowOutline(branchedFlow());
    expect(getBranchRows(outline, "c", 7)).toEqual([]);
    expect(getBranchRows(outline, "ghost", 0)).toEqual([]);
  });
});
