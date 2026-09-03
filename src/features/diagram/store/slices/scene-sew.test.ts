import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Flow, FlowStep } from "../../model/diagram.types";
import { createTestDiagramStore } from "../test-utils";

type Store = ReturnType<typeof createTestDiagramStore>;

/**
 * A diagram with one base component, a scene on top of it, and a component
 * that exists only inside that scene. The flow walks through all three.
 */
function sceneWithOwnComponent(store: Store) {
  const diagram = store.getState().addDiagram("Scenes", "context");
  store.getState().openDiagram(diagram.id);
  const base = store.getState().addComponent("system", "Gateway", null, { x: 0, y: 0 });
  const tail = store.getState().addComponent("system", "Ledger", null, { x: 400, y: 0 });

  const scene = store.getState().addScene("Proposal");
  store.getState().setActiveScene(scene.id);
  const inScene = store.getState().addComponent("system", "Cache", null, { x: 200, y: 0 });

  const flow = store.getState().addFlow(diagram.id, "Checkout", "")!;
  const steps: Record<string, FlowStep> = {
    s1: { id: "s1", type: "action", next: "s2", componentId: base.id },
    s2: { id: "s2", type: "action", next: "s3", componentId: inScene.id },
    s3: { id: "s3", type: "action", componentId: tail.id },
  };
  store.getState().updateFlow(flow.id, { steps, entryStepId: "s1" });

  return { diagramId: diagram.id, sceneId: scene.id, flowId: flow.id, base, tail, inScene };
}

function readFlow(store: Store, flowId: string): Flow {
  const diagramId = store.getState().activeDiagramId!;
  const flow = store.getState().diagrams[diagramId]!.snapshot.flows[flowId];
  if (!flow) throw new Error(`flow ${flowId} is gone`);
  return flow;
}

function sceneOf(store: Store, sceneId: string) {
  const diagramId = store.getState().activeDiagramId!;
  return store.getState().diagrams[diagramId]!.scenes![sceneId]!;
}

describe("deleting a component a scene owns", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes the script up instead of leaving the step pointing at nothing", () => {
    const store = createTestDiagramStore();
    const { flowId, inScene } = sceneWithOwnComponent(store);

    store.getState().removeComponent(inScene.id);

    const flow = readFlow(store, flowId);
    expect(Object.keys(flow.steps).sort()).toEqual(["s1", "s3"]);
    expect(flow.steps.s1!.next).toBe("s3");
  });

  it("says what left and where the script joined up", () => {
    const store = createTestDiagramStore();
    const { flowId, inScene } = sceneWithOwnComponent(store);

    store.getState().removeComponent(inScene.id);

    expect(store.getState()._flowSewNotices?.notices).toEqual([
      { flowId, flowName: "Checkout", elementName: "Cache", fromLabel: "1", toLabel: "2" },
    ]);
  });

  it("puts the component and the step back together on undo", () => {
    const store = createTestDiagramStore();
    const { flowId, sceneId, inScene } = sceneWithOwnComponent(store);

    store.getState().removeComponent(inScene.id);
    store.getState().undo();

    expect(Object.keys(readFlow(store, flowId).steps).sort()).toEqual(["s1", "s2", "s3"]);
    expect(sceneOf(store, sceneId).addedComponents[inScene.id]).toBeDefined();
  });

  it("takes them away again on redo", () => {
    const store = createTestDiagramStore();
    const { flowId, sceneId, inScene } = sceneWithOwnComponent(store);

    store.getState().removeComponent(inScene.id);
    store.getState().undo();
    store.getState().redo();

    expect(Object.keys(readFlow(store, flowId).steps).sort()).toEqual(["s1", "s3"]);
    expect(sceneOf(store, sceneId).addedComponents[inScene.id]).toBeUndefined();
  });

  it("takes the scene's own wiring with it, and sews the steps that named it", () => {
    const store = createTestDiagramStore();
    const { diagramId, sceneId, base, inScene } = sceneWithOwnComponent(store);
    const link = store.getState().addConnection(base.id, inScene.id, "warms")!;
    const flow = store.getState().addFlow(diagramId, "Wire", "")!;
    store.getState().updateFlow(flow.id, {
      steps: {
        w1: { id: "w1", type: "action", next: "w2", componentId: base.id },
        w2: { id: "w2", type: "action", next: "w3", connectionId: link.id },
        w3: { id: "w3", type: "action", description: "answers" },
      },
      entryStepId: "w1",
    });

    store.getState().removeComponent(inScene.id);

    expect(sceneOf(store, sceneId).addedConnections[link.id]).toBeUndefined();
    expect(Object.keys(readFlow(store, flow.id).steps).sort()).toEqual(["w1", "w3"]);
  });

  it("sews the same way through the batched delete", () => {
    const store = createTestDiagramStore();
    const { flowId, inScene } = sceneWithOwnComponent(store);

    store.getState().removeElements([inScene.id], []);

    expect(Object.keys(readFlow(store, flowId).steps).sort()).toEqual(["s1", "s3"]);
    expect(store.getState()._flowSewNotices?.notices).toHaveLength(1);
  });

  it("sews the same way when the scene panel drops it", () => {
    const store = createTestDiagramStore();
    const { flowId, sceneId, inScene } = sceneWithOwnComponent(store);

    store.getState().removeComponentFromScene(sceneId, inScene.id);

    expect(Object.keys(readFlow(store, flowId).steps).sort()).toEqual(["s1", "s3"]);
    expect(store.getState()._flowSewNotices?.notices).toHaveLength(1);
  });
});

describe("hiding a base component inside a scene", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves the script exactly as it was", () => {
    const store = createTestDiagramStore();
    const { flowId, base } = sceneWithOwnComponent(store);
    const before = structuredClone(readFlow(store, flowId).steps);

    store.getState().removeComponent(base.id);

    expect(readFlow(store, flowId).steps).toEqual(before);
  });

  it("says nothing, because nothing was sewn", () => {
    const store = createTestDiagramStore();
    const { base } = sceneWithOwnComponent(store);

    store.getState().removeComponent(base.id);

    expect(store.getState()._flowSewNotices).toBeNull();
  });

  it("still takes the component out of the scene's view", () => {
    const store = createTestDiagramStore();
    const { sceneId, base } = sceneWithOwnComponent(store);

    store.getState().removeComponent(base.id);

    expect(sceneOf(store, sceneId).removedComponentIds).toContain(base.id);
  });
});

describe("deleting a connection a scene owns", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes the script up and names the connection that left", () => {
    const store = createTestDiagramStore();
    const { diagramId, sceneId, base, tail } = sceneWithOwnComponent(store);
    const link = store.getState().addConnection(base.id, tail.id, "calls")!;
    const flow = store.getState().addFlow(diagramId, "Wire", "")!;
    store.getState().updateFlow(flow.id, {
      steps: {
        w1: { id: "w1", type: "action", next: "w2", componentId: base.id },
        w2: { id: "w2", type: "action", next: "w3", connectionId: link.id },
        w3: { id: "w3", type: "action", componentId: tail.id },
      },
      entryStepId: "w1",
    });
    expect(sceneOf(store, sceneId).addedConnections[link.id]).toBeDefined();

    store.getState().removeConnection(link.id);

    expect(Object.keys(readFlow(store, flow.id).steps).sort()).toEqual(["w1", "w3"]);
    expect(store.getState()._flowSewNotices?.notices[0]!.elementName).toBe("calls");
  });
});
