import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDiagramStore } from "../test-utils";
import { HISTORY_COALESCE_MS } from "../store.constants";

/**
 * History coalesces soft mutations within HISTORY_COALESCE_MS. Real user actions
 * are seconds apart, so tests use fake timers and step past the window between
 * logical actions to assert per-action undo isolation.
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const settle = () => vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

function seed() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Edges", "context");
  store.getState().openDiagram(diagram.id);
  const a = store.getState().addComponent("component", "A", null, { x: 0, y: 0 });
  const b = store.getState().addComponent("component", "B", null, { x: 200, y: 0 });
  const conn = store.getState().addConnection(a.id, b.id, "uses");
  settle();
  return { store, diagramId: diagram.id, connId: conn.id };
}

const points = (store: ReturnType<typeof createTestDiagramStore>, diagramId: string, id: string) =>
  store.getState().diagrams[diagramId].edgeLayouts[id]?.points;

describe("edge control-point actions", () => {
  it("adds a control point at the requested index", () => {
    const { store, diagramId, connId } = seed();
    store.getState().addEdgeControlPoint(diagramId, connId, { id: "p1", x: 50, y: 40 }, 0);
    store.getState().addEdgeControlPoint(diagramId, connId, { id: "p2", x: 100, y: -40 }, 1);
    expect(points(store, diagramId, connId)).toEqual([
      { id: "p1", x: 50, y: 40 },
      { id: "p2", x: 100, y: -40 },
    ]);
  });

  it("sets and removes control points", () => {
    const { store, diagramId, connId } = seed();
    store.getState().setEdgeControlPoints(diagramId, connId, [
      { id: "p1", x: 10, y: 10 },
      { id: "p2", x: 20, y: 20 },
    ]);
    store.getState().removeEdgeControlPoint(diagramId, connId, "p1");
    expect(points(store, diagramId, connId)).toEqual([{ id: "p2", x: 20, y: 20 }]);
  });

  it("resets control points and drops an otherwise-empty layout entry", () => {
    const { store, diagramId, connId } = seed();
    store.getState().setEdgeControlPoints(diagramId, connId, [{ id: "p1", x: 10, y: 10 }]);
    store.getState().resetEdgeControlPoints(diagramId, connId);
    expect(store.getState().diagrams[diagramId].edgeLayouts[connId]).toBeUndefined();
  });

  it("undoes and redoes a control-point edit (edgeLayouts are captured in history)", () => {
    const { store, diagramId, connId } = seed();
    store.getState().addEdgeControlPoint(diagramId, connId, { id: "p1", x: 50, y: 40 }, 0);
    expect(points(store, diagramId, connId)).toHaveLength(1);

    store.getState().undo();
    expect(points(store, diagramId, connId) ?? []).toHaveLength(0);

    store.getState().redo();
    expect(points(store, diagramId, connId)).toEqual([{ id: "p1", x: 50, y: 40 }]);
  });

  it("reconnecting an endpoint repoints the connection (source/target)", () => {
    const { store, diagramId, connId } = seed();
    const c = store.getState().addComponent("component", "C", null, { x: 400, y: 0 });

    // useEdgeReconnect maps a reconnect drop to updateConnection(source/target).
    store.getState().updateConnection(connId, { targetId: c.id });

    const conn = store.getState().diagrams[diagramId].snapshot.connections[connId];
    expect(conn.targetId).toBe(c.id);
  });

  it("collapses a streamed drag into a single undo step back to the pre-drag state", () => {
    const { store, diagramId, connId } = seed();
    store.getState().setEdgeControlPoints(diagramId, connId, [{ id: "p1", x: 10, y: 10 }]);
    settle();

    // Simulate one drag gesture: first move checkpoints, later moves stream.
    store
      .getState()
      .setEdgeControlPoints(diagramId, connId, [{ id: "p1", x: 20, y: 20 }], { history: true });
    store
      .getState()
      .setEdgeControlPoints(diagramId, connId, [{ id: "p1", x: 30, y: 30 }], { history: false });
    store
      .getState()
      .setEdgeControlPoints(diagramId, connId, [{ id: "p1", x: 40, y: 40 }], { history: false });

    store.getState().undo();
    expect(points(store, diagramId, connId)).toEqual([{ id: "p1", x: 10, y: 10 }]);
  });
});
