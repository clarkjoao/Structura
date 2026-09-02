import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "../model/flow.types";
import { moveStep } from "./flow-move";
import { checkFlowInvariants } from "./flow-graph";

/**
 * Dragging the step where branches meet again.
 *
 * The move used to succeed and quietly undo the reconvergence: both tails were
 * left with no successor and `checkFlowInvariants` said nothing, because the
 * result is still a perfectly valid flow — just not the one the author drew.
 * That is why this is checked apart from the invariants.
 */

function flow(steps: Record<string, FlowStep>, entryStepId = "s1"): Flow {
  return { id: "f", name: "F", mermaid: "", diagramId: "d", steps, entryStepId };
}

/** s1 → c ◇ {A: a, B: b} → j. `j` is the join; it ends the flow. */
const TWO_BRANCH = () =>
  flow({
    s1: { id: "s1", type: "action", next: "c" },
    c: {
      id: "c",
      type: "condition",
      branches: [
        { label: "A", nextId: "a" },
        { label: "B", nextId: "b" },
      ],
    },
    a: { id: "a", type: "action", next: "j" },
    b: { id: "b", type: "action", next: "j" },
    j: { id: "j", type: "action" },
  });

/** The same, with a step after the join, so the join can move and still be met. */
const TWO_BRANCH_THEN_K = () =>
  flow({
    ...TWO_BRANCH().steps,
    j: { id: "j", type: "action", next: "k" },
    k: { id: "k", type: "action" },
  });

const THREE_BRANCH = () =>
  flow({
    s1: { id: "s1", type: "action", next: "c" },
    c: {
      id: "c",
      type: "condition",
      branches: [
        { label: "A", nextId: "a" },
        { label: "B", nextId: "b" },
        { label: "C", nextId: "x" },
      ],
    },
    a: { id: "a", type: "action", next: "j" },
    b: { id: "b", type: "action", next: "j" },
    x: { id: "x", type: "action", next: "j" },
    j: { id: "j", type: "action" },
  });

/** An inner condition inside one branch of an outer one; `ji` joins the inner pair. */
const NESTED = () =>
  flow({
    s1: { id: "s1", type: "action", next: "c" },
    c: {
      id: "c",
      type: "condition",
      branches: [
        { label: "Inner", nextId: "c2" },
        { label: "Other", nextId: "z" },
      ],
    },
    c2: {
      id: "c2",
      type: "condition",
      branches: [
        { label: "In1", nextId: "x" },
        { label: "In2", nextId: "y" },
      ],
    },
    x: { id: "x", type: "action", next: "ji" },
    y: { id: "y", type: "action", next: "ji" },
    ji: { id: "ji", type: "action", next: "end" },
    z: { id: "z", type: "action", next: "end" },
    end: { id: "end", type: "action" },
  });

/** Which of `forkId`'s branches can still reach `id`, by name. */
function branchesReaching(f: Flow, forkId: string, id: string): string[] {
  const fork = f.steps[forkId]!;
  const canReach = (from: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const at = stack.pop()!;
      if (at === id) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      const step = f.steps[at];
      if (!step) continue;
      if (step.branches?.length) stack.push(...step.branches.map((br) => br.nextId));
      else if (step.next) stack.push(step.next);
    }
    return false;
  };
  return (fork.branches ?? []).filter((br) => canReach(br.nextId)).map((br) => br.label);
}

describe("the drag that would undo a reconvergence is refused", () => {
  it("refuses to drag the join in front of the branch point that feeds it", () => {
    const result = moveStep(TWO_BRANCH(), "j", { kind: "before", stepId: "s1" });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("join_broken");
  });

  it("leaves the flow alone when it refuses", () => {
    const before = TWO_BRANCH();
    const snapshot = JSON.stringify(before.steps);

    moveStep(before, "j", { kind: "before", stepId: "s1" });

    expect(JSON.stringify(before.steps)).toBe(snapshot);
  });

  it("names the branch point in the detail, not just the step", () => {
    const result = moveStep(TWO_BRANCH(), "j", { kind: "before", stepId: "s1" });

    expect(result.ok === false && result.detail).toContain('"c"');
  });

  it("refuses the same drag when three branches meet there", () => {
    const result = moveStep(THREE_BRANCH(), "j", { kind: "before", stepId: "s1" });

    expect(result.ok === false && result.code).toBe("join_broken");
  });

  it("refuses pulling the join into one of its own branches", () => {
    // The join survives, reachable through "A" only — "B" no longer meets it.
    const result = moveStep(TWO_BRANCH(), "j", { kind: "before", stepId: "a" });

    expect(result.ok === false && result.code).toBe("join_broken");
  });

  it("refuses it when a branch points straight at the join, with no step between", () => {
    // `A` arrives at `j` directly; `B` gets there through `b`. Two predecessors
    // still, one of them a branch rather than a `next`.
    const direct = flow({
      s1: { id: "s1", type: "action", next: "c" },
      c: {
        id: "c",
        type: "condition",
        branches: [
          { label: "A", nextId: "j" },
          { label: "B", nextId: "b" },
        ],
      },
      b: { id: "b", type: "action", next: "j" },
      j: { id: "j", type: "action", next: "end" },
      end: { id: "end", type: "action" },
    });

    const result = moveStep(direct, "j", { kind: "before", stepId: "s1" });

    expect(result.ok === false && result.code).toBe("join_broken");
  });

  it("refuses it for an inner join dragged in front of its own condition", () => {
    const result = moveStep(NESTED(), "ji", { kind: "before", stepId: "s1" });

    expect(result.ok === false && result.code).toBe("join_broken");
  });
});

describe("a move that leaves the branches still meeting is allowed", () => {
  it("lets the join move further down, where both branches still arrive", () => {
    const result = moveStep(TWO_BRANCH_THEN_K(), "j", { kind: "after", stepId: "k" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = flow(result.steps, result.entryStepId);
    expect(branchesReaching(moved, "c", "j")).toEqual(["A", "B"]);
    expect(checkFlowInvariants(moved)).toEqual([]);
  });

  it("lets an ordinary step be dropped into a branch", () => {
    const result = moveStep(TWO_BRANCH_THEN_K(), "k", { kind: "before", stepId: "a" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps.c!.branches![0]!.nextId).toBe("k");
  });

  it("leaves the inner join alone when it moves into a neighbouring branch", () => {
    // Deliberately still permitted: the inner pair keeps meeting at "end".
    const result = moveStep(NESTED(), "ji", { kind: "before", stepId: "z" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = flow(result.steps, result.entryStepId);
    expect(branchesReaching(moved, "c2", "end")).toEqual(["In1", "In2"]);
  });

  it("says nothing about a flow that has no branch point at all", () => {
    const linear = flow({
      s1: { id: "s1", type: "action", next: "s2" },
      s2: { id: "s2", type: "action", next: "s3" },
      s3: { id: "s3", type: "action" },
    });

    const result = moveStep(linear, "s3", { kind: "before", stepId: "s1" });

    expect(result.ok).toBe(true);
  });

  it("says nothing about a step that merely sits after a join", () => {
    // Both branches reach `k`, but only `j` points at it: it is not the join.
    const result = moveStep(TWO_BRANCH_THEN_K(), "k", { kind: "before", stepId: "s1" });

    expect(result.ok).toBe(true);
  });

  it("still refuses a branch point on its own older rule", () => {
    const joinAndFork = flow({
      ...TWO_BRANCH().steps,
      j: {
        id: "j",
        type: "condition",
        branches: [
          { label: "P", nextId: "p" },
          { label: "Q", nextId: "q" },
        ],
      },
      p: { id: "p", type: "action" },
      q: { id: "q", type: "action" },
    });

    const result = moveStep(joinAndFork, "j", { kind: "before", stepId: "s1" });

    expect(result.ok === false && result.code).toBe("branch_point_move");
  });
});

describe("what the invariants could never have caught", () => {
  it("would have produced a valid flow, which is why this needed its own rule", () => {
    // The rule is switched off here by moving a step that is not a join, so the
    // same relinking runs and the result is checked: valid, and reconvergence
    // is gone. That is the shape the refusal exists to prevent.
    const withTail = TWO_BRANCH_THEN_K();
    const result = moveStep(withTail, "k", { kind: "before", stepId: "s1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(checkFlowInvariants(flow(result.steps, result.entryStepId))).toEqual([]);
  });

  it("reports every branch that used to meet there as still meeting, when allowed", () => {
    const result = moveStep(TWO_BRANCH_THEN_K(), "j", { kind: "after", stepId: "k" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = flow(result.steps, result.entryStepId);
    expect(branchesReaching(moved, "c", "j").length).toBe(2);
  });
});
