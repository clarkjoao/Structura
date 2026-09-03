import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkFlowInvariants } from "../../utils/flow-graph";
import { computeFlowStepLabels } from "../../utils/flow-labels";
import type { Flow } from "../../model/diagram.types";
import { createTestDiagramStore } from "../test-utils";

type Store = ReturnType<typeof createTestDiagramStore>;

/** A diagram with one empty flow — the shape a recording starts from. */
function openFlow(store: Store): { flowId: string; diagramId: string } {
  const diagram = store.getState().addDiagram("Flows", "context");
  store.getState().openDiagram(diagram.id);
  const flow = store.getState().addFlow(diagram.id, "", "");
  if (!flow) throw new Error("addFlow returned null");
  return { flowId: flow.id, diagramId: diagram.id };
}

function readFlow(store: Store, flowId: string): Flow {
  const diagramId = store.getState().activeDiagramId!;
  const flow = store.getState().diagrams[diagramId]!.snapshot.flows[flowId];
  if (!flow) throw new Error(`flow ${flowId} is gone`);
  return flow;
}

/** stepId → derived label, so an assertion can read the graph the way the panel does. */
function labelsOf(store: Store, flowId: string): Record<string, string> {
  return computeFlowStepLabels(readFlow(store, flowId)).labels;
}

describe("flowsSlice — writing a flow one step at a time", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fills the step a new flow starts with rather than leaving it empty", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    const emptyStepId = Object.keys(readFlow(store, flowId).steps)[0]!;

    const result = store
      .getState()
      .recordFlowStep(flowId, { componentId: "n1" }, { kind: "trunk" });

    expect(result).toMatchObject({ ok: true, stepId: emptyStepId });
    const flow = readFlow(store, flowId);
    expect(Object.keys(flow.steps)).toEqual([emptyStepId]);
    expect(flow.steps[emptyStepId]!.componentId).toBe("n1");
  });

  it("appends every step after the first", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    store.getState().recordFlowStep(flowId, { componentId: "n1" }, { kind: "trunk" });
    store.getState().recordFlowStep(flowId, { componentId: "n2" }, { kind: "trunk" });
    store.getState().recordFlowStep(flowId, { connectionId: "e1" }, { kind: "trunk" });

    const flow = readFlow(store, flowId);
    const labels = labelsOf(store, flowId);
    const byLabel = Object.fromEntries(
      Object.entries(labels).map(([stepId, label]) => [label, flow.steps[stepId]!]),
    );
    expect(Object.keys(flow.steps)).toHaveLength(3);
    expect(byLabel["1"]!.componentId).toBe("n1");
    expect(byLabel["2"]!.componentId).toBe("n2");
    expect(byLabel["3"]!.connectionId).toBe("e1");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("writes each step to the store as it is recorded, not at the end", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    store.getState().recordFlowStep(flowId, { componentId: "n1" }, { kind: "trunk" });
    expect(Object.keys(readFlow(store, flowId).steps)).toHaveLength(1);
    store.getState().recordFlowStep(flowId, { componentId: "n2" }, { kind: "trunk" });
    expect(Object.keys(readFlow(store, flowId).steps)).toHaveLength(2);
  });

  it("records into the branch the cursor points at, filling its placeholder first", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    const conditionId = store
      .getState()
      .recordFlowStep(flowId, { componentId: "n1" }, { kind: "trunk" });
    if (!conditionId.ok || !conditionId.stepId) throw new Error("expected a step");
    store.getState().convertStepToCondition(flowId, conditionId.stepId, "paid?", ["yes", "no"]);

    const cursor = { kind: "branch" as const, conditionStepId: conditionId.stepId, branchIndex: 0 };
    const first = store.getState().recordFlowStep(flowId, { componentId: "n2" }, cursor);
    const second = store.getState().recordFlowStep(flowId, { componentId: "n3" }, cursor);

    const flow = readFlow(store, flowId);
    const labels = labelsOf(store, flowId);
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    // The branch's placeholder was filled, then one step appended behind it.
    expect(labels[(first as { stepId: string }).stepId]).toBe("1a");
    expect(labels[(second as { stepId: string }).stepId]).toBe("1a.1");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("brings the branches back together when recording returns to the main flow", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    const first = store.getState().recordFlowStep(flowId, { componentId: "n1" }, { kind: "trunk" });
    if (!first.ok || !first.stepId) throw new Error("expected a step");
    store.getState().convertStepToCondition(flowId, first.stepId, "paid?", ["yes", "no"]);
    const cursorA = { kind: "branch" as const, conditionStepId: first.stepId, branchIndex: 0 };
    const cursorB = { kind: "branch" as const, conditionStepId: first.stepId, branchIndex: 1 };
    store.getState().recordFlowStep(flowId, { componentId: "n2" }, cursorA);
    store.getState().recordFlowStep(flowId, { componentId: "n3" }, cursorB);

    const back = store.getState().recordFlowStep(flowId, { componentId: "n4" }, { kind: "trunk" });

    if (!back.ok || !back.stepId) throw new Error("expected a step");
    const flow = readFlow(store, flowId);
    const labels = labelsOf(store, flowId);
    expect(labels[back.stepId]).toBe("2");
    const meeting = Object.values(flow.steps).filter((step) => step.next === back.stepId);
    expect(meeting).toHaveLength(2);
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("refuses to record into a flow the active diagram does not have", () => {
    const store = createTestDiagramStore();
    openFlow(store);
    expect(
      store.getState().recordFlowStep("ghost", { componentId: "n1" }, { kind: "trunk" }),
    ).toEqual({
      ok: false,
      code: "unknown_flow",
      detail: expect.any(String),
    });
  });
});

describe("flowsSlice — one undo step per session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes back a whole recording, not one click of it", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Undo", "context");
    store.getState().openDiagram(diagram.id);

    store.getState().beginFlowSession();
    const flow = store.getState().addFlow(diagram.id, "Checkout", "")!;
    store.getState().recordFlowStep(flow.id, { componentId: "n1" }, { kind: "trunk" });
    store.getState().recordFlowStep(flow.id, { componentId: "n2" }, { kind: "trunk" });
    store.getState().recordFlowStep(flow.id, { componentId: "n3" }, { kind: "trunk" });
    store.getState().commitFlowSession();

    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().diagrams[diagram.id]!.snapshot.flows[flow.id]).toBeUndefined();
  });

  it("puts the diagram back the way a cancelled session found it", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Cancel", "context");
    store.getState().openDiagram(diagram.id);
    const kept = store.getState().addFlow(diagram.id, "Kept", "")!;
    const pastBefore = store.getState().past.length;

    store.getState().beginFlowSession();
    const draft = store.getState().addFlow(diagram.id, "Draft", "")!;
    store.getState().recordFlowStep(draft.id, { componentId: "n1" }, { kind: "trunk" });
    store.getState().cancelFlowSession();

    const flows = store.getState().diagrams[diagram.id]!.snapshot.flows;
    expect(flows[draft.id]).toBeUndefined();
    expect(flows[kept.id]).toBeDefined();
    expect(store.getState().past).toHaveLength(pastBefore);
    expect(store.getState()._flowSession).toBeNull();
  });

  it("leaves a cancelled session with no undo step of its own", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Cancel2", "context");
    store.getState().openDiagram(diagram.id);
    store.getState().addComponent("system", "N1", null, { x: 0, y: 0 });
    const componentsBefore = Object.keys(
      store.getState().diagrams[diagram.id]!.snapshot.components,
    ).length;

    store.getState().beginFlowSession();
    const draft = store.getState().addFlow(diagram.id, "Draft", "")!;
    store.getState().recordFlowStep(draft.id, { componentId: "n1" }, { kind: "trunk" });
    store.getState().cancelFlowSession();

    // The next Ctrl+Z must reach the component, not a checkpoint that changes nothing.
    store.getState().undo();
    expect(Object.keys(store.getState().diagrams[diagram.id]!.snapshot.components)).toHaveLength(
      componentsBefore - 1,
    );
  });

  it("gives every gesture its own undo step when no session is open", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    store.getState().recordFlowStep(flowId, { componentId: "n1" }, { kind: "trunk" });
    const pastBefore = store.getState().past.length;

    const first = store.getState().insertFlowStepAt(flowId, {
      kind: "after",
      stepId: Object.keys(readFlow(store, flowId).steps)[0]!,
    });
    if (!first.ok || !first.stepId) throw new Error("expected a step");
    store.getState().insertFlowStepAt(flowId, { kind: "after", stepId: first.stepId });

    expect(store.getState().past.length).toBe(pastBefore + 2);
  });
});

describe("flowsSlice — editing the graph from the panel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function threeSteps(store: Store) {
    const { flowId } = openFlow(store);
    store.getState().recordFlowStep(flowId, { componentId: "n1" }, { kind: "trunk" });
    store.getState().recordFlowStep(flowId, { componentId: "n2" }, { kind: "trunk" });
    store.getState().recordFlowStep(flowId, { componentId: "n3" }, { kind: "trunk" });
    const labels = labelsOf(store, flowId);
    const byLabel = Object.fromEntries(
      Object.entries(labels).map(([stepId, label]) => [label, stepId]),
    );
    return { flowId, byLabel };
  }

  it("relinks the graph when a step is moved", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);

    const result = store
      .getState()
      .moveFlowStep(flowId, byLabel["3"]!, { kind: "before", stepId: byLabel["1"]! });

    expect(result).toMatchObject({ ok: true });
    const labels = labelsOf(store, flowId);
    expect(labels[byLabel["3"]!]).toBe("1");
    expect(labels[byLabel["1"]!]).toBe("2");
    expect(checkFlowInvariants(readFlow(store, flowId))).toEqual([]);
  });

  it("refuses to move a branch point and says why", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);
    store.getState().convertStepToCondition(flowId, byLabel["2"]!, "paid?", ["yes", "no"]);
    const before = readFlow(store, flowId);

    const result = store
      .getState()
      .moveFlowStep(flowId, byLabel["2"]!, { kind: "before", stepId: byLabel["1"]! });

    expect(result).toMatchObject({ ok: false, code: "branch_point_move" });
    expect(readFlow(store, flowId).steps).toEqual(before.steps);
  });

  it("sews the graph shut when a step is removed", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);

    const result = store.getState().removeFlowSteps(flowId, [byLabel["2"]!]);

    expect(result).toMatchObject({ ok: true, removedStepIds: [byLabel["2"]!], blocked: [] });
    const flow = readFlow(store, flowId);
    expect(flow.steps[byLabel["1"]!]!.next).toBe(byLabel["3"]!);
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("holds back the removal of a branch point and reports it", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);
    store.getState().convertStepToCondition(flowId, byLabel["2"]!, "paid?", ["yes", "no"]);

    const result = store.getState().removeFlowSteps(flowId, [byLabel["2"]!]);

    expect(result).toMatchObject({ ok: true, removedStepIds: [] });
    if (!result.ok) throw new Error("expected a result");
    expect(result.blocked).toEqual([
      {
        code: "branch_point",
        stepId: byLabel["2"],
        branchTargetIds: expect.any(Array),
        detail: expect.any(String),
      },
    ]);
    expect(readFlow(store, flowId).steps[byLabel["2"]!]).toBeDefined();
  });

  it("turns a step into a condition and keeps what followed it", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);

    const result = store
      .getState()
      .convertStepToCondition(flowId, byLabel["2"]!, "paid?", ["yes", "no"]);

    expect(result).toMatchObject({ ok: true });
    const flow = readFlow(store, flowId);
    const labels = labelsOf(store, flowId);
    expect(flow.steps[byLabel["2"]!]!.type).toBe("condition");
    expect(flow.steps[byLabel["2"]!]!.conditionLabel).toBe("paid?");
    expect(labels[byLabel["3"]!]).toBe("3");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("adds and removes a branch", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);
    store.getState().convertStepToCondition(flowId, byLabel["2"]!, "paid?", ["yes", "no"]);

    const added = store.getState().addFlowBranch(flowId, byLabel["2"]!, "maybe");
    expect(added).toMatchObject({ ok: true });
    expect(readFlow(store, flowId).steps[byLabel["2"]!]!.branches).toHaveLength(3);

    const removed = store.getState().removeFlowBranch(flowId, byLabel["2"]!, 2);
    expect(removed).toMatchObject({ ok: true });
    const flow = readFlow(store, flowId);
    expect(flow.steps[byLabel["2"]!]!.branches).toHaveLength(2);
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("renames a branch without touching the wiring", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);
    store.getState().convertStepToCondition(flowId, byLabel["2"]!, "paid?", ["yes", "no"]);
    const before = readFlow(store, flowId).steps[byLabel["2"]!]!.branches!.map((b) => b.nextId);

    store.getState().setFlowBranchLabel(flowId, byLabel["2"]!, 1, "declined");

    const branches = readFlow(store, flowId).steps[byLabel["2"]!]!.branches!;
    expect(branches.map((b) => b.label)).toEqual(["yes", "declined"]);
    expect(branches.map((b) => b.nextId)).toEqual(before);
  });

  it("adds an empty step where the panel asked for it", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);

    const result = store.getState().insertFlowStepAt(flowId, {
      kind: "after",
      stepId: byLabel["1"]!,
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok || !result.stepId) throw new Error("expected a step");
    const labels = labelsOf(store, flowId);
    expect(labels[result.stepId]).toBe("2");
    expect(labels[byLabel["2"]!]).toBe("3");
    expect(checkFlowInvariants(readFlow(store, flowId))).toEqual([]);
  });

  it("refuses to add a step after a branch point", () => {
    const store = createTestDiagramStore();
    const { flowId, byLabel } = threeSteps(store);
    store.getState().convertStepToCondition(flowId, byLabel["2"]!, "paid?", ["yes", "no"]);

    const result = store.getState().insertFlowStepAt(flowId, {
      kind: "after",
      stepId: byLabel["2"]!,
    });

    expect(result).toMatchObject({ ok: false, code: "target_after_branch_point" });
  });
});
