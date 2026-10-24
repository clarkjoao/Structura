import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";
import { HISTORY_COALESCE_MS } from "../store.constants";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Swap", "container");
  store.getState().openDiagram(diagram.id);
  const a = store.getState().addComponent("system", "A", null, { x: 0, y: 0 });
  const b = store.getState().addComponent("system", "B", null, { x: 300, y: 0 });
  const conn = store.getState().addConnection(a.id, b.id, "calls")!;
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
  const d = () => store.getState().diagrams[diagram.id];
  return { store, a, b, conn, d, diagramId: diagram.id };
}

describe("swapConnectionDirection", () => {
  it("makes the target the source and the source the target", () => {
    const { store, a, b, conn, d } = setup();
    expect(store.getState().swapConnectionDirection(conn.id)).toBe(true);
    expect(d().snapshot.connections[conn.id]).toMatchObject({ sourceId: b.id, targetId: a.id });
  });

  it("keeps everything else: label, technology, interaction, kind", () => {
    const { store, conn, d } = setup();
    store
      .getState()
      .updateConnection(conn.id, { technology: "gRPC", interaction: "async", kind: "event" });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().swapConnectionDirection(conn.id);
    expect(d().snapshot.connections[conn.id]).toMatchObject({
      label: "calls",
      technology: "gRPC",
      interaction: "async",
      kind: "event",
    });
  });

  it("is one undo step", () => {
    const { store, a, b, conn, d } = setup();
    const past = store.getState().past.length;
    store.getState().swapConnectionDirection(conn.id);
    expect(store.getState().past.length).toBe(past + 1);
    store.getState().undo();
    expect(d().snapshot.connections[conn.id]).toMatchObject({ sourceId: a.id, targetId: b.id });
  });

  it("drops the bends drawn for the old route and mirrors the label offset", () => {
    const { store, conn, d, diagramId } = setup();
    store.getState().setEdgeControlPoints(diagramId, conn.id, [{ id: "p", x: 1, y: 2 }]);
    store.getState().setEdgeLabelOffset(diagramId, conn.id, 0.25);
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().swapConnectionDirection(conn.id);
    expect(d().edgeLayouts[conn.id]?.points).toBeUndefined();
    expect(d().edgeLayouts[conn.id]?.labelOffset).toBe(0.75);
  });

  it("clears a stored cross-axis side, which belonged to its old end", () => {
    const { store, conn, d } = setup();
    store.getState().updateConnection(conn.id, { sourceSide: "bottom", targetSide: "top" });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().swapConnectionDirection(conn.id);
    expect(d().snapshot.connections[conn.id].sourceSide).toBeUndefined();
    expect(d().snapshot.connections[conn.id].targetSide).toBeUndefined();
  });

  it("does nothing for a connection that does not exist", () => {
    const { store } = setup();
    const past = store.getState().past.length;
    expect(store.getState().swapConnectionDirection("ghost")).toBe(false);
    expect(store.getState().past.length).toBe(past);
  });
});
