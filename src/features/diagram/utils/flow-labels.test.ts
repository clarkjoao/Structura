import { describe, it, expect } from "vitest";
import { chain, condition, expectFlowInvariants, makeFlow } from "@/test/flow-graph-helpers";
import { branchLetter, compareFlowStepLabels, computeFlowStepLabels } from "./flow-labels";
import { checkFlowInvariants } from "./flow-graph";

describe("branchLetter", () => {
  it("is bijective base-26 so every branch index gets a distinct letter", () => {
    expect(branchLetter(0)).toBe("a");
    expect(branchLetter(1)).toBe("b");
    expect(branchLetter(25)).toBe("z");
    expect(branchLetter(26)).toBe("aa");
    expect(branchLetter(27)).toBe("ab");
    expect(branchLetter(51)).toBe("az");
    expect(branchLetter(52)).toBe("ba");
  });
});

describe("compareFlowStepLabels", () => {
  it("orders the way the reader walks the flow", () => {
    const shuffled = ["4", "3a.2", "3", "10", "3a", "3b", "3a.2b", "3a.2b.1", "2"];
    expect([...shuffled].sort(compareFlowStepLabels)).toEqual([
      "2",
      "3",
      "3a",
      "3a.2",
      "3a.2b",
      "3a.2b.1",
      "3b",
      "4",
      "10",
    ]);
  });
});

describe("computeFlowStepLabels", () => {
  it("numbers a linear chain 1, 2, 3, 4 from the entry step", () => {
    const flow = makeFlow(chain("s1", "s2", "s3", "s4"), "s1");
    expectFlowInvariants(flow);

    const result = computeFlowStepLabels(flow);

    expect(result.labels).toEqual({ s1: "1", s2: "2", s3: "3", s4: "4" });
    expect(result.order).toEqual(["s1", "s2", "s3", "s4"]);
    expect(result.unlabeled).toEqual([]);
    expect(result.ambiguities).toEqual([]);
  });

  it("numbers from entryStepId, not from the insertion order of the record", () => {
    // The record is written tail-first; only entryStepId decides where 1 is.
    const flow = makeFlow(chain("s1", "s2", "s3").reverse(), "s1");

    expect(computeFlowStepLabels(flow).labels).toEqual({ s1: "1", s2: "2", s3: "3" });
  });

  it("gives each branch a letter in the order declared in branches[]", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        condition("s3", [
          ["x", "bx"],
          ["y", "by"],
          ["z", "bz"],
        ]),
        { id: "bx", type: "action" },
        { id: "by", type: "action" },
        { id: "bz", type: "action" },
      ],
      "s1",
    );
    expectFlowInvariants(flow);

    expect(computeFlowStepLabels(flow).labels).toEqual({
      s1: "1",
      s2: "2",
      s3: "3",
      bx: "3a",
      by: "3b",
      bz: "3c",
    });
  });

  it("dots the continuation inside a branch", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        condition("s3", [
          ["yes", "a0"],
          ["no", "b0"],
        ]),
        { id: "a0", type: "action", next: "a1" },
        { id: "a1", type: "action", next: "a2" },
        { id: "a2", type: "action" },
        { id: "b0", type: "action" },
      ],
      "s1",
    );
    expectFlowInvariants(flow);

    expect(computeFlowStepLabels(flow).labels).toEqual({
      s1: "1",
      s2: "2",
      s3: "3",
      a0: "3a",
      a1: "3a.1",
      a2: "3a.2",
      b0: "3b",
    });
  });

  it("repeats the pattern for a branch inside a branch", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        condition("s3", [
          ["yes", "a0"],
          ["no", "b0"],
        ]),
        { id: "a0", type: "action", next: "a1" },
        { id: "a1", type: "action", next: "a2" },
        condition("a2", [
          ["left", "n0"],
          ["right", "n1"],
        ]),
        { id: "n0", type: "action" },
        { id: "n1", type: "action", next: "n1a" },
        { id: "n1a", type: "action" },
        { id: "b0", type: "action" },
      ],
      "s1",
    );
    expectFlowInvariants(flow);

    expect(computeFlowStepLabels(flow).labels).toEqual({
      s1: "1",
      s2: "2",
      s3: "3",
      a0: "3a",
      a1: "3a.1",
      a2: "3a.2",
      n0: "3a.2a",
      n1: "3a.2b",
      n1a: "3a.2b.1",
      b0: "3b",
    });
  });

  it("returns a reconverging step to the main sequence, right after the branch point", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        condition("s3", [
          ["yes", "a0"],
          ["no", "b0"],
        ]),
        { id: "a0", type: "action", next: "a1" },
        { id: "a1", type: "action", next: "join" },
        { id: "b0", type: "action", next: "join" },
        { id: "join", type: "action", next: "tail" },
        { id: "tail", type: "action" },
      ],
      "s1",
    );
    expectFlowInvariants(flow);
    const result = computeFlowStepLabels(flow);

    expect(result.labels).toEqual({
      s1: "1",
      s2: "2",
      s3: "3",
      a0: "3a",
      a1: "3a.1",
      b0: "3b",
      join: "4",
      tail: "5",
    });
    expect(result.order).toEqual(["s1", "s2", "s3", "a0", "a1", "b0", "join", "tail"]);
    expect(result.ambiguities).toEqual([]);
  });

  it("treats two branches landing on the same step as one reconvergence, not an ambiguity", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        condition("s3", [
          ["yes", "join"],
          ["no", "join"],
        ]),
        { id: "join", type: "action" },
      ],
      "s1",
    );
    expectFlowInvariants(flow);
    const result = computeFlowStepLabels(flow);

    expect(result.labels.join).toBe("4");
    expect(result.ambiguities).toEqual([]);
  });

  it("reconverges inside a branch without leaving the branch's sequence", () => {
    const flow = makeFlow(
      [
        condition("s1", [
          ["outer-a", "a0"],
          ["outer-b", "b0"],
        ]),
        condition("a0", [
          ["inner-x", "x"],
          ["inner-y", "y"],
        ]),
        { id: "x", type: "action", next: "inner-join" },
        { id: "y", type: "action", next: "inner-join" },
        { id: "inner-join", type: "action" },
        { id: "b0", type: "action" },
      ],
      "s1",
    );
    expectFlowInvariants(flow);

    expect(computeFlowStepLabels(flow).labels).toEqual({
      s1: "1",
      a0: "1a",
      x: "1aa",
      y: "1ab",
      "inner-join": "1a.1",
      b0: "1b",
    });
  });

  it("keeps a branch's declared slot when another branch dangles", () => {
    const flow = makeFlow(
      [
        condition("s1", [
          ["a", "ok-a"],
          ["b", "ghost"],
          ["c", "ok-c"],
        ]),
        { id: "ok-a", type: "action" },
        { id: "ok-c", type: "action" },
      ],
      "s1",
    );

    // The dangling branch is a genuine invariant violation, reported as such…
    expect(checkFlowInvariants(flow)).toEqual([
      expect.objectContaining({ code: "dangling_reference", stepId: "s1", targetId: "ghost" }),
    ]);
    // …and it does not shift the letter of the branch declared after it.
    expect(computeFlowStepLabels(flow).labels).toEqual({ s1: "1", "ok-a": "1a", "ok-c": "1c" });
  });

  it("labels nothing beyond the entry when branches shadow next", () => {
    // getNextSteps ignores `next` on a step that has branches; numbering follows
    // the same rule, so the shadowed target shows up as unreachable.
    const flow = makeFlow(
      [
        { ...condition("s1", [["only", "b0"]]), next: "shadowed" },
        { id: "b0", type: "action" },
        { id: "shadowed", type: "action" },
      ],
      "s1",
    );
    const result = computeFlowStepLabels(flow);

    expect(result.labels).toEqual({ s1: "1", b0: "1a" });
    expect(result.unlabeled).toEqual(["shadowed"]);
    expect(checkFlowInvariants(flow)).toEqual([
      expect.objectContaining({ code: "unreachable_step", stepId: "shadowed" }),
    ]);
  });

  it("leaves an unreachable island unlabeled", () => {
    const flow = makeFlow([{ id: "s1", type: "action" }, ...chain("island-1", "island-2")], "s1");

    const result = computeFlowStepLabels(flow);

    expect(result.labels).toEqual({ s1: "1" });
    expect(result.unlabeled).toEqual(["island-1", "island-2"]);
  });

  it("is stable across two builds of the same structure with different key order", () => {
    const steps = [
      { id: "s1", type: "action" as const, next: "s2" },
      { id: "s2", type: "action" as const, next: "s3" },
      condition("s3", [
        ["yes", "a0"],
        ["no", "b0"],
      ]),
      { id: "a0", type: "action" as const, next: "join" },
      { id: "b0", type: "action" as const, next: "join" },
      { id: "join", type: "action" as const },
    ];

    const forward = computeFlowStepLabels(makeFlow(steps, "s1"));
    const reversed = computeFlowStepLabels(makeFlow([...steps].reverse(), "s1"));

    expect(reversed.labels).toEqual(forward.labels);
    expect(reversed.order).toEqual(forward.order);
  });

  it("reports the join whose incoming chains close at two different branch points", () => {
    // Branch c of s1 skips the first join entirely and lands on the second one,
    // so "the number after the branch point" has two candidate branch points.
    const flow = makeFlow(
      [
        condition("s1", [
          ["a", "a0"],
          ["b", "b0"],
          ["c", "c0"],
        ]),
        { id: "a0", type: "action", next: "join1" },
        { id: "b0", type: "action", next: "join1" },
        { id: "join1", type: "action", next: "s4" },
        condition("s4", [["x", "x0"]]),
        { id: "x0", type: "action", next: "join2" },
        { id: "c0", type: "action", next: "join2" },
        { id: "join2", type: "action" },
      ],
      "s1",
    );
    expectFlowInvariants(flow);
    const result = computeFlowStepLabels(flow);

    expect(result.labels.join1).toBe("2");
    expect(result.labels.s4).toBe("3");
    expect(result.ambiguities).toEqual([
      { stepId: "join2", closingLabels: ["1", "3"], chosenLabel: "4" },
    ]);
    expect(result.labels.join2).toBe("4");
  });

  it("reports a label collision instead of resolving it silently", () => {
    // 27 branches on s1 push the last one to the letter "aa", which is also the
    // label the first branch of branch "1a" gets.
    const branches: [string, string][] = [];
    const steps = [];
    for (let i = 0; i < 27; i++) {
      branches.push([`b${i}`, `t${i}`]);
      steps.push({ id: `t${i}`, type: "action" as const });
    }
    const flow = makeFlow(
      [
        condition("s1", branches),
        ...steps.map((step) => (step.id === "t0" ? condition("t0", [["deep", "deep-0"]]) : step)),
        { id: "deep-0", type: "action" as const },
      ],
      "s1",
    );
    expectFlowInvariants(flow);
    const result = computeFlowStepLabels(flow);

    expect(result.labels["t26"]).toBe("1aa");
    expect(result.labels["deep-0"]).toBe("1aa");
    expect(result.collisions).toEqual(["1aa"]);
  });

  it("labels nothing when the flow has no entry step", () => {
    const flow = makeFlow(chain("s1", "s2"), undefined, { entryStepId: undefined });

    expect(computeFlowStepLabels(flow)).toEqual({
      labels: {},
      order: [],
      unlabeled: ["s1", "s2"],
      ambiguities: [],
      collisions: [],
    });
  });

  it("stops at a cycle rather than looping, and the checker names it", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { id: "s2", type: "action", next: "s3" },
        { id: "s3", type: "action", next: "s2" },
      ],
      "s1",
    );

    const result = computeFlowStepLabels(flow);

    expect(result.labels).toEqual({ s1: "1" });
    expect(result.unlabeled).toEqual(["s2", "s3"]);
    expect(checkFlowInvariants(flow)).toEqual([
      expect.objectContaining({ code: "cycle", stepId: "s3", targetId: "s2" }),
    ]);
  });
});
