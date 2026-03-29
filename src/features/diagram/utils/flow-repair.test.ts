import { describe, it, expect } from "vitest";
import { repairFlow } from "./flow-repair";
import type { Flow } from "../model/flow.types";

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: "flow-1",
    name: "Test Flow",
    mermaid: "",
    diagramId: "d-1",
    steps: {},
    ...overrides,
  };
}

describe("repairFlow", () => {
  it("recalculates entryStepId when the entry step is removed", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", description: "first" },
        s2: { id: "s2", type: "action", description: "second" },
      },
    });

    const result = repairFlow(flow, ["s1"]);

    expect(result.steps).not.toHaveProperty("s1");
    expect(result.entryStepId).toBe("s2");
  });

  it("clears next reference pointing to a removed step", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", next: "s2" },
        s2: { id: "s2", type: "action" },
      },
    });

    const result = repairFlow(flow, ["s2"]);

    const s1 = result.steps.s1;
    if (!s1 || s1.type !== "action") throw new Error("Expected action step");
    expect(s1.next).toBeUndefined();
    expect(result.steps).not.toHaveProperty("s2");
  });

  it("filters branches pointing to a removed step", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: {
          id: "s1",
          type: "condition",
          branches: [
            { label: "yes", nextId: "s2" },
            { label: "no", nextId: "s3" },
          ],
        },
        s2: { id: "s2", type: "action" },
        s3: { id: "s3", type: "action" },
      },
    });

    const result = repairFlow(flow, ["s2"]);

    const s1 = result.steps.s1;
    if (!s1 || s1.type !== "condition") throw new Error("Expected condition step");
    expect(s1.branches).toEqual([{ label: "no", nextId: "s3" }]);
    expect(result.steps).not.toHaveProperty("s2");
  });

  it("handles removal of multiple steps simultaneously", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", next: "s2" },
        s2: { id: "s2", type: "action", next: "s3" },
        s3: {
          id: "s3",
          type: "condition",
          branches: [
            { label: "a", nextId: "s4" },
            { label: "b", nextId: "s1" },
          ],
        },
        s4: { id: "s4", type: "action" },
      },
    });

    const result = repairFlow(flow, ["s2", "s4"]);

    expect(Object.keys(result.steps)).toEqual(["s1", "s3"]);
    const s1 = result.steps.s1;
    if (!s1 || s1.type !== "action") throw new Error("Expected action step");
    expect(s1.next).toBeUndefined();
    const s3 = result.steps.s3;
    if (!s3 || s3.type !== "condition") throw new Error("Expected condition step");
    expect(s3.branches).toEqual([{ label: "b", nextId: "s1" }]);
    expect(result.entryStepId).toBe("s1");
  });

  it("returns identical structure when no steps are removed", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: {
          id: "s1",
          type: "condition",
          next: "s2",
          branches: [{ label: "alt", nextId: "s2" }],
        },
        s2: { id: "s2", type: "action" },
      },
    });

    const result = repairFlow(flow, []);

    expect(result.entryStepId).toBe("s1");
    expect(Object.keys(result.steps)).toEqual(["s1", "s2"]);
    const s1 = result.steps.s1;
    if (!s1 || s1.type !== "condition") throw new Error("Expected condition step");
    expect(s1.next).toBe("s2");
    expect(s1.branches).toEqual([{ label: "alt", nextId: "s2" }]);
  });

  it("returns undefined entryStepId when all steps are removed", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action" },
      },
    });

    const result = repairFlow(flow, ["s1"]);

    expect(result.steps).toEqual({});
    expect(result.entryStepId).toBeUndefined();
  });
});
