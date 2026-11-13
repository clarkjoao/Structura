import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDiagramStore } from "../test-utils";
import { HISTORY_COALESCE_MS } from "../store.constants";
import type { LayoutEdgeEffects } from "../actions.types";

/**
 * `applyLayoutEdges` is the arrangement's edge writes in one `set()`. It must
 * leave the diagram exactly as the per-edge actions it replaces did, in one
 * notification, and keep the arrangement one undo step.
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
  const c = store.getState().addComponent("component", "C", null, { x: 400, y: 0 });
  const ab = store.getState().addConnection(a.id, b.id, "uses")!;
  const bc = store.getState().addConnection(b.id, c.id, "calls")!;
  const ac = store.getState().addConnection(a.id, c.id, "")!;
  // A route the user drew, and one with a label offset only.
  store.getState().setEdgeControlPoints(diagram.id, ab.id, [{ id: "u1", x: 1, y: 1 }]);
  store.getState().setEdgeLabelOffset(diagram.id, ac.id, 0.3);
  settle();
  const effects: LayoutEdgeEffects = {
    handleOrders: [
      { componentId: a.id, side: "outgoing", connectionIds: [ac.id, ab.id] },
      { componentId: c.id, side: "incoming", connectionIds: [bc.id, ac.id] },
    ],
    resetConnectionIds: [ab.id, bc.id, ac.id],
    routes: [
      { connectionId: ab.id, points: [{ id: "r1", x: 10, y: 20 }], labelOffset: 0.5 },
      { connectionId: bc.id, points: [{ id: "r2", x: 30, y: 40 }], labelOffset: 1.7 },
    ],
  };
  return { store, diagramId: diagram.id, ids: { a: a.id, c: c.id, ab: ab.id, ac: ac.id }, effects };
}

type Store = ReturnType<typeof createTestDiagramStore>;

/** What the per-edge actions wrote, one call each. */
function applyOneByOne(store: Store, diagramId: string, effects: LayoutEdgeEffects) {
  const state = store.getState();
  for (const { componentId, side, connectionIds } of effects.handleOrders) {
    state.updateHandleOrder(componentId, side, connectionIds);
  }
  for (const id of effects.resetConnectionIds) state.resetEdgeControlPoints(diagramId, id);
  for (const { connectionId, points, labelOffset } of effects.routes) {
    state.setEdgeControlPoints(diagramId, connectionId, points, { history: false });
    if (labelOffset !== undefined) {
      state.setEdgeLabelOffset(diagramId, connectionId, labelOffset, { history: false });
    }
  }
}

function written(store: Store, diagramId: string) {
  const d = store.getState().diagrams[diagramId];
  return {
    edgeLayouts: d.edgeLayouts,
    handleOrders: Object.fromEntries(
      Object.values(d.snapshot.components).map((c) => [c.id, c.handleOrder]),
    ),
  };
}

describe("applyLayoutEdges", () => {
  it("writes what the per-edge actions wrote", () => {
    const batched = seed();
    batched.store.getState().applyLayoutEdges(batched.diagramId, batched.effects);

    const oneByOne = seed();
    applyOneByOne(oneByOne.store, oneByOne.diagramId, oneByOne.effects);

    // Ids differ between the two stores; compare by position in the seed.
    const shape = (s: ReturnType<typeof seed>) => {
      const out = written(s.store, s.diagramId);
      return {
        ab: out.edgeLayouts[s.ids.ab],
        ac: out.edgeLayouts[s.ids.ac],
        edgeCount: Object.keys(out.edgeLayouts).length,
        aOut: out.handleOrders[s.ids.a]?.outgoing.length,
        cIn: out.handleOrders[s.ids.c]?.incoming.length,
      };
    };
    expect(shape(batched)).toEqual(shape(oneByOne));
    expect(shape(batched).ab).toEqual({ points: [{ id: "r1", x: 10, y: 20 }], labelOffset: 0.5 });
    // The reset keeps a label offset; the route's offset is clamped like setEdgeLabelOffset.
    expect(shape(batched).ac).toEqual({ labelOffset: 0.3 });
    const bc = batched.effects.routes[1]!.connectionId;
    expect(written(batched.store, batched.diagramId).edgeLayouts[bc]?.labelOffset).toBe(1);
  });

  it("notifies subscribers once", () => {
    const { store, diagramId, effects } = seed();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.getState().applyLayoutEdges(diagramId, effects);
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the arrangement one undo step, back to the routes before it", () => {
    const { store, diagramId, ids, effects } = seed();
    const before = store.getState().diagrams[diagramId].edgeLayouts[ids.ab];
    const past = store.getState().past.length;
    store.getState().applyLayoutEdges(diagramId, effects);
    // One checkpoint, taken by the first reset that clears a route.
    expect(store.getState().past.length).toBe(past + 1);
    store.getState().undo();
    expect(store.getState().diagrams[diagramId].edgeLayouts[ids.ab]).toEqual(before);
  });

  it("takes no checkpoint when no reset clears a route", () => {
    const { store, diagramId, ids, effects } = seed();
    const past = store.getState().past.length;
    store.getState().applyLayoutEdges(diagramId, {
      ...effects,
      resetConnectionIds: [ids.ac],
    });
    expect(store.getState().past.length).toBe(past);
  });
});
