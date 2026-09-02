import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Flow } from "../../model/diagram.types";
import { createTestDiagramStore } from "../test-utils";

type Store = ReturnType<typeof createTestDiagramStore>;

function openFlow(store: Store): { flowId: string; diagramId: string } {
  const diagram = store.getState().addDiagram("History", "context");
  store.getState().openDiagram(diagram.id);
  const flow = store.getState().addFlow(diagram.id, "Checkout", "");
  if (!flow) throw new Error("addFlow returned null");
  return { flowId: flow.id, diagramId: diagram.id };
}

function readFlow(store: Store, flowId: string): Flow {
  const diagramId = store.getState().activeDiagramId!;
  const flow = store.getState().diagrams[diagramId]!.snapshot.flows[flowId];
  if (!flow) throw new Error(`flow ${flowId} is gone`);
  return flow;
}

/** How many undo steps it takes to get back to a flow with `stepCount` steps. */
function undosBackTo(store: Store, flowId: string, stepCount: number): number {
  for (let i = 1; i <= 10; i++) {
    store.getState().undo();
    const flow =
      store.getState().diagrams[store.getState().activeDiagramId!]!.snapshot.flows[flowId];
    if (flow && Object.keys(flow.steps).length === stepCount) return i;
  }
  return -1;
}

describe("a script edit is one undo step", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts back the graph an edit outside a session replaced", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    const before = Object.keys(readFlow(store, flowId).steps);

    store.getState().updateFlow(flowId, {
      steps: {
        a: { id: "a", type: "action", next: "b" },
        b: { id: "b", type: "action" },
      },
      entryStepId: "a",
    });
    expect(Object.keys(readFlow(store, flowId).steps).sort()).toEqual(["a", "b"]);

    store.getState().undo();

    expect(Object.keys(readFlow(store, flowId).steps)).toEqual(before);
  });

  it("takes exactly one undo, not none and not two", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    const startingSteps = Object.keys(readFlow(store, flowId).steps).length;

    store.getState().updateFlow(flowId, {
      steps: {
        a: { id: "a", type: "action", next: "b" },
        b: { id: "b", type: "action" },
      },
      entryStepId: "a",
    });

    expect(undosBackTo(store, flowId, startingSteps)).toBe(1);
  });

  it("puts back a name an edit replaced", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);

    store.getState().updateFlow(flowId, { name: "Refund" });
    expect(readFlow(store, flowId).name).toBe("Refund");

    store.getState().undo();

    expect(readFlow(store, flowId).name).toBe("Checkout");
  });
});

describe("a recording session stays one undo step", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Eight steps and a rename, all inside one open session. */
  function recordEight(store: Store, flowId: string): void {
    store.getState().beginFlowSession();
    for (let i = 0; i < 8; i++) {
      const written = store.getState().recordFlowStep(
        flowId,
        { description: `s${i}` },
        {
          kind: "trunk",
        },
      );
      expect(written.ok).toBe(true);
    }
    // What finalizing does before it commits: name an unnamed flow.
    store.getState().updateFlow(flowId, { name: "Recorded" });
    store.getState().commitFlowSession();
  }

  it("comes back to where the recording started in a single undo", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    const startingSteps = Object.keys(readFlow(store, flowId).steps).length;

    recordEight(store, flowId);
    expect(Object.keys(readFlow(store, flowId).steps).length).toBe(8);

    expect(undosBackTo(store, flowId, startingSteps)).toBe(1);
  });

  it("leaves exactly one checkpoint behind, however many clicks went into it", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    const before = store.getState().past.length;

    recordEight(store, flowId);

    expect(store.getState().past.length - before).toBe(1);
  });

  it("puts the name back too, not just the steps", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);

    recordEight(store, flowId);
    store.getState().undo();

    expect(readFlow(store, flowId).name).toBe("Checkout");
    expect(Object.keys(readFlow(store, flowId).steps).length).toBe(1);
  });
});
