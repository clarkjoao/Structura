import { describe, expect, it } from "vitest";
import type { Component, SfnStateComponent } from "../model/component.types";
import type { NodeLayout } from "../model/layout.types";
import { isSfnStep, parallelBranches, retryBadge, sfnStateCount, taskCaption } from "./sfn";

const c = (
  id: string,
  type: string,
  parentId: string | null,
  extra: Record<string, unknown> = {},
) => ({ id, name: id, description: "", parentId, type, ...extra }) as unknown as Component;

const machine = (): Record<string, Component> => ({
  sm: c("sm", "sfn-state-machine", null),
  start: c("start", "sfn-state", "sm", { stateType: "Start" }),
  validate: c("validate", "sfn-state", "sm"),
  choice: c("choice", "sfn-state", "sm", { stateType: "Choice" }),
  par: c("par", "sfn-parallel", "sm"),
  a: c("a", "sfn-state", "par"),
  b: c("b", "sfn-state", "par"),
  map: c("map", "sfn-map", "par"),
  item: c("item", "sfn-state", "map"),
  note: c("note", "note", "sm"),
  other: c("other", "sfn-state", "elsewhere"),
});

describe("sfnStateCount", () => {
  it("counts states at any depth, Parallel and Map included, not the start marker nor other nodes", () => {
    expect(sfnStateCount("sm", machine())).toBe(7);
    expect(sfnStateCount("par", machine())).toBe(4);
    expect(sfnStateCount("nobody", machine())).toBe(0);
  });

  it("ends on a parent cycle", () => {
    const cyclic = { x: c("x", "sfn-parallel", "y"), y: c("y", "sfn-parallel", "x") };
    expect(sfnStateCount("x", cyclic)).toBe(1);
    // A seen child does not stop its siblings from being counted.
    const branching = {
      x: c("x", "sfn-parallel", "y"),
      y: c("y", "sfn-parallel", "x"),
      w: c("w", "sfn-state", "y"),
    };
    expect(sfnStateCount("x", branching)).toBe(2);
  });

  it("isSfnStep", () => {
    const m = machine();
    expect(isSfnStep(m.validate)).toBe(true);
    expect(isSfnStep(m.start)).toBe(false);
    expect(isSfnStep(m.map)).toBe(true);
    expect(isSfnStep(m.note)).toBe(false);
  });
});

describe("parallelBranches", () => {
  const box = (id: string, x: number, width = 100): NodeLayout => ({
    elementId: id,
    x,
    y: 0,
    width,
    height: 40,
  });

  it("groups children whose spans overlap into one branch, left to right, with a divider in each gap", () => {
    const layouts = {
      a: box("a", 200),
      b: box("b", 10),
      map: box("map", 250, 80),
      item: box("item", 0),
    };
    expect(parallelBranches("par", machine(), layouts)).toEqual({
      branches: [["b"], ["a", "map"]],
      dividers: [155],
    });
  });

  it("touching spans are two branches; no children, no branches", () => {
    const layouts = { a: box("a", 0), b: box("b", 100), map: box("map", 400) };
    expect(parallelBranches("par", machine(), layouts).branches).toEqual([["a"], ["b"], ["map"]]);
    expect(parallelBranches("par", machine(), layouts).dividers).toEqual([100, 300]);
    expect(parallelBranches("sm2", machine(), layouts)).toEqual({ branches: [], dividers: [] });
  });
});

describe("retryBadge", () => {
  it("reads the first retrier with ASL's defaults, and counts the rest", () => {
    expect(retryBadge(undefined)).toBeNull();
    expect(retryBadge([])).toBeNull();
    expect(retryBadge([{}])).toBe("retry 3× · backoff 2");
    expect(retryBadge([{ maxAttempts: 5, backoffRate: 1.5 }, {}])).toBe(
      "retry 5× · backoff 1.5 +1",
    );
    expect(retryBadge([{ maxAttempts: 0 }])).toBe("retry 0× · backoff 2");
  });
});

describe("taskCaption", () => {
  const s = (extra: Partial<SfnStateComponent>) =>
    ({
      id: "t",
      name: "t",
      description: "",
      parentId: null,
      type: "sfn-state",
      ...extra,
    }) as SfnStateComponent;
  it("says the service and the action", () => {
    expect(taskCaption(s({ service: "lambda", action: "Invoke" }))).toBe("Lambda · Invoke");
    expect(taskCaption(s({ service: "dynamodb" }))).toBe("DynamoDB");
    expect(taskCaption(s({ service: "custom-api", action: "Call" }))).toBe("custom-api · Call");
    expect(taskCaption(s({ action: "Invoke" }))).toBe("Invoke");
    expect(taskCaption(s({}))).toBeNull();
  });
});
