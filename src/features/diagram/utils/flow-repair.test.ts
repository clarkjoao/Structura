import { describe, it, expect } from "vitest";
import {
  getFlowStepIdsReferencingRemovedElements,
  repairFlow,
  repairFlowsAfterRemovingDiagramElements,
  toFlowSewNotices,
} from "./flow-repair";
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

  it("drops next when the removed step had no successor to sew to", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", next: "s2" },
        s2: { id: "s2", type: "action" },
      },
    });

    const result = repairFlow(flow, ["s2"]);

    expect(result.steps.s1.next).toBeUndefined();
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

    expect(result.steps.s1.branches).toEqual([{ label: "no", nextId: "s3" }]);
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
    // s1 -> s2 -> s3 with s2 gone: the chain is sewn, not severed.
    expect(result.steps.s1.next).toBe("s3");
    expect(result.steps.s3.branches).toEqual([{ label: "b", nextId: "s1" }]);
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
    expect(result.steps.s1.next).toBe("s2");
    expect(result.steps.s1.branches).toEqual([{ label: "alt", nextId: "s2" }]);
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

  it("clears next when it points to a non-existent step id", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", next: "missing" },
      },
    });

    const result = repairFlow(flow, []);

    expect(result.steps.s1.next).toBeUndefined();
    expect(result.entryStepId).toBe("s1");
  });

  it("removes branches whose nextId does not exist", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: {
          id: "s1",
          type: "condition",
          branches: [
            { label: "ok", nextId: "s2" },
            { label: "bad", nextId: "ghost" },
          ],
        },
        s2: { id: "s2", type: "action" },
      },
    });

    const result = repairFlow(flow, []);

    expect(result.steps.s1.branches).toEqual([{ label: "ok", nextId: "s2" }]);
  });

  it("clears entryStepId when it does not match any step", () => {
    const flow = makeFlow({
      entryStepId: "ghost-entry",
      steps: {
        s1: { id: "s1", type: "action" },
      },
    });

    const result = repairFlow(flow, []);

    expect(result.entryStepId).toBeUndefined();
    expect(result.steps.s1).toBeDefined();
  });

  it("is idempotent for an already valid flow", () => {
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

    expect(result.entryStepId).toBe(flow.entryStepId);
    expect(result.steps).toEqual(flow.steps);
  });
});

describe("getFlowStepIdsReferencingRemovedElements", () => {
  it("lists steps that reference removed components or connections", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", componentId: "c1", next: "s2" },
        s2: { id: "s2", type: "action", connectionId: "n1" },
      },
    });
    const byComponent = getFlowStepIdsReferencingRemovedElements(flow, new Set(["c1"]), new Set());
    expect(byComponent.sort()).toEqual(["s1"]);
    const byConnection = getFlowStepIdsReferencingRemovedElements(flow, new Set(), new Set(["n1"]));
    expect(byConnection.sort()).toEqual(["s2"]);
  });
});

describe("repairFlowsAfterRemovingDiagramElements", () => {
  it("removes flow steps tied to deleted components and fixes next pointers", () => {
    const flow = makeFlow({
      entryStepId: "s1",
      steps: {
        s1: { id: "s1", type: "action", next: "s2", componentId: "gone" },
        s2: { id: "s2", type: "action" },
      },
    });
    const flows = { f1: flow };
    repairFlowsAfterRemovingDiagramElements(flows, new Set(["gone"]), new Set());
    expect(flows.f1!.steps.s1).toBeUndefined();
    expect(flows.f1!.steps.s2).toBeDefined();
    expect(flows.f1!.entryStepId).toBe("s2");
  });
});

describe("what the sew says it did", () => {
  /** 1 → 2 → 3 → 4, where step 2 is the one whose node leaves the diagram. */
  function fourSteps(): Flow {
    return makeFlow({
      entryStepId: "s1",
      name: "Checkout",
      steps: {
        s1: { id: "s1", type: "action", next: "s2", componentId: "keep" },
        s2: { id: "s2", type: "action", next: "s3", componentId: "doomed" },
        s3: { id: "s3", type: "action", next: "s4", componentId: "keep" },
        s4: { id: "s4", type: "action" },
      },
    });
  }

  it("reports the join in the numbers the panel shows, after the sew", () => {
    const flows = { f1: fourSteps() };
    const [report] = repairFlowsAfterRemovingDiagramElements(flows, new Set(["doomed"]), new Set());
    expect(report).toMatchObject({ flowId: "flow-1", flowName: "Checkout" });
    // Step 2 went; step 1 now leads to what is numbered 2 afterwards.
    expect(report!.joins).toEqual([
      { stepId: "s2", componentId: "doomed", removedLabel: "2", fromLabel: "1", toLabel: "2" },
    ]);
  });

  it("says nothing about a flow the removal did not touch", () => {
    const flows = { f1: fourSteps() };
    expect(repairFlowsAfterRemovingDiagramElements(flows, new Set(["other"]), new Set())).toEqual(
      [],
    );
  });

  it("reports the join in the numbers from after the sew, not before it", () => {
    // Two steps go at once, so the numbers on both sides of the join move:
    // before, the surviving neighbours are 2 and 4; after, they are 1 and 2.
    const flows = {
      f1: makeFlow({
        entryStepId: "s1",
        name: "Checkout",
        steps: {
          s1: { id: "s1", type: "action", next: "s2", componentId: "doomed-a" },
          s2: { id: "s2", type: "action", next: "s3", componentId: "keep" },
          s3: { id: "s3", type: "action", next: "s4", componentId: "doomed-b" },
          s4: { id: "s4", type: "action", componentId: "keep" },
        },
      }),
    };
    const [report] = repairFlowsAfterRemovingDiagramElements(
      flows,
      new Set(["doomed-a", "doomed-b"]),
      new Set(),
    );
    const forS3 = report!.joins.find((join) => join.stepId === "s3")!;
    expect(forS3.removedLabel).toBe("3");
    expect(forS3.fromLabel).toBe("1");
    expect(forS3.toLabel).toBe("2");
  });

  it("counts the condition as the predecessor of the branch step that went", () => {
    const flows = {
      f1: makeFlow({
        entryStepId: "s1",
        name: "Checkout",
        steps: {
          s1: { id: "s1", type: "action", next: "c", componentId: "keep" },
          c: {
            id: "c",
            type: "condition",
            branches: [
              { label: "yes", nextId: "a1" },
              { label: "no", nextId: "b1" },
            ],
          },
          a1: { id: "a1", type: "action", next: "a2", componentId: "doomed" },
          a2: { id: "a2", type: "action", componentId: "keep" },
          b1: { id: "b1", type: "action", componentId: "keep" },
        },
      }),
    };
    const [report] = repairFlowsAfterRemovingDiagramElements(flows, new Set(["doomed"]), new Set());
    expect(report!.joins).toEqual([
      { stepId: "a1", componentId: "doomed", removedLabel: "2a", fromLabel: "2", toLabel: "2a" },
    ]);
  });

  it("leaves the ends of a join out when the step had no neighbour there", () => {
    const flows = {
      f1: makeFlow({
        entryStepId: "s1",
        steps: {
          s1: { id: "s1", type: "action", next: "s2", componentId: "doomed" },
          s2: { id: "s2", type: "action", componentId: "keep" },
        },
      }),
    };
    const [report] = repairFlowsAfterRemovingDiagramElements(flows, new Set(["doomed"]), new Set());
    // The entry went: nothing led to it, so there is no "from" side.
    expect(report!.joins).toEqual([
      { stepId: "s1", componentId: "doomed", removedLabel: "1", toLabel: "1" },
    ]);
  });

  it("names what left the diagram", () => {
    const flows = { f1: fourSteps() };
    const reports = repairFlowsAfterRemovingDiagramElements(flows, new Set(["doomed"]), new Set());
    expect(toFlowSewNotices(reports, new Map([["doomed", "Checkout API"]]))).toEqual([
      {
        flowId: "flow-1",
        flowName: "Checkout",
        elementName: "Checkout API",
        fromLabel: "1",
        toLabel: "2",
      },
    ]);
  });

  it("leaves the name out rather than inventing one", () => {
    const flows = { f1: fourSteps() };
    const reports = repairFlowsAfterRemovingDiagramElements(flows, new Set(["doomed"]), new Set());
    expect(toFlowSewNotices(reports, new Map())).toEqual([
      { flowId: "flow-1", flowName: "Checkout", fromLabel: "1", toLabel: "2" },
    ]);
  });
});
