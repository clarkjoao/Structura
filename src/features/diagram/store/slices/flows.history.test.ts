import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Flow } from "../../model/diagram.types";
import { HISTORY_COALESCE_MS } from "../store.constants";
import { createTestDiagramStore } from "../test-utils";

type Store = ReturnType<typeof createTestDiagramStore>;

/**
 * Step past the coalescing window, so what comes next is its own gesture.
 *
 * The clock is frozen in these tests, and a soft checkpoint taken within
 * `HISTORY_COALESCE_MS` of the last one folds into it. Without this the seeding
 * and the edit under test would be the same undo step by accident.
 */
function nextGesture(): void {
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
}

function openFlow(store: Store): { flowId: string; diagramId: string } {
  const diagram = store.getState().addDiagram("History", "context");
  store.getState().openDiagram(diagram.id);
  const flow = store.getState().addFlow(diagram.id, "Checkout", "");
  if (!flow) throw new Error("addFlow returned null");
  nextGesture();
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

describe("a whole flow coming or going is one undo step", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function flowIds(store: Store): string[] {
    const diagramId = store.getState().activeDiagramId!;
    return Object.keys(store.getState().diagrams[diagramId]!.snapshot.flows).sort();
  }

  /** Three named steps written onto the seeded flow, as its own gesture. */
  function writeGraph(store: Store, flowId: string): void {
    store.getState().updateFlow(flowId, {
      steps: {
        a: { id: "a", type: "action", next: "b" },
        b: { id: "b", type: "action", next: "c" },
        c: { id: "c", type: "action" },
      },
      entryStepId: "a",
    });
    nextGesture();
  }

  it("puts a deleted flow back whole, with its steps and its name", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    writeGraph(store, flowId);

    store.getState().removeFlow(flowId);
    expect(flowIds(store)).toEqual([]);

    store.getState().undo();

    const back = readFlow(store, flowId);
    expect(Object.keys(back.steps).sort()).toEqual(["a", "b", "c"]);
    expect(back.entryStepId).toBe("a");
    expect(back.name).toBe("Checkout");
  });

  it("takes exactly one undo to bring it back, not two", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    writeGraph(store, flowId);

    store.getState().removeFlow(flowId);

    expect(undosBackTo(store, flowId, 3)).toBe(1);
  });

  it("leaves exactly one checkpoint behind for the deletion", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    writeGraph(store, flowId);
    const before = store.getState().past.length;

    store.getState().removeFlow(flowId);

    expect(store.getState().past.length - before).toBe(1);
  });

  it("gets its own undo step even right after an edit", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    // No gesture boundary: the rename and the deletion are back to back, which
    // is where a soft checkpoint would fold one into the other.
    store.getState().updateFlow(flowId, { name: "Refund" });
    const before = store.getState().past.length;

    store.getState().removeFlow(flowId);

    expect(store.getState().past.length - before).toBe(1);
    store.getState().undo();
    expect(readFlow(store, flowId).name).toBe("Refund");
  });

  it("takes the flow away again on redo", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    writeGraph(store, flowId);

    store.getState().removeFlow(flowId);
    store.getState().undo();
    expect(flowIds(store)).toEqual([flowId]);
    store.getState().redo();

    expect(flowIds(store)).toEqual([]);
  });

  it("records nothing when the flow asked for was never there", () => {
    const store = createTestDiagramStore();
    openFlow(store);
    const before = store.getState().past.length;

    store.getState().removeFlow("flow-that-never-was");

    expect(store.getState().past.length - before).toBe(0);
  });

  it("takes back the creation of a flow", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("History", "context");
    store.getState().openDiagram(diagram.id);
    nextGesture();

    const flow = store.getState().addFlow(diagram.id, "Refund", "")!;
    expect(flowIds(store)).toEqual([flow.id]);

    store.getState().undo();

    expect(flowIds(store)).toEqual([]);
  });

  it("leaves exactly one checkpoint behind for the creation", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("History", "context");
    store.getState().openDiagram(diagram.id);
    nextGesture();
    const before = store.getState().past.length;

    store.getState().addFlow(diagram.id, "Refund", "");

    expect(store.getState().past.length - before).toBe(1);
  });

  it("records nothing for a flow added to a diagram nobody is looking at", () => {
    const store = createTestDiagramStore();
    const open = store.getState().addDiagram("Open", "context");
    const other = store.getState().addDiagram("Other", "context");
    store.getState().openDiagram(open.id);
    nextGesture();
    const before = store.getState().past.length;

    const flow = store.getState().addFlow(other.id, "Elsewhere", "")!;

    expect(store.getState().diagrams[other.id]!.snapshot.flows[flow.id]).toBeDefined();
    expect(store.getState().past.length - before).toBe(0);
  });
});

describe("a recording still opens no checkpoint but its own", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not let the flow it creates open a second one", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("History", "context");
    store.getState().openDiagram(diagram.id);
    nextGesture();
    const before = store.getState().past.length;

    // What startRecording does, in order: the session first, then the flow.
    store.getState().beginFlowSession();
    store.getState().addFlow(diagram.id, "", "");

    expect(store.getState().past.length - before).toBe(1);
  });

  it("does not let a deletion inside it open a second one", () => {
    const store = createTestDiagramStore();
    const { flowId } = openFlow(store);
    const before = store.getState().past.length;

    store.getState().beginFlowSession();
    store.getState().removeFlow(flowId);

    expect(store.getState().past.length - before).toBe(1);
  });
});
