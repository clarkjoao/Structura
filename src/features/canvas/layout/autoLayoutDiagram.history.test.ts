import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore } from "@/features/diagram";
import { HISTORY_COALESCE_MS } from "@/features/diagram/store/store.constants";
import { applyDiagramAutoLayout, planDiagramAutoLayout } from "./autoLayoutDiagram";

/**
 * An automatic arrangement joins the undo step of the edit that caused it: the
 * whole apply — positions, handle order, reset corridors, ELK corridors — must
 * push no checkpoint, however long the layout took.
 */

function planActive() {
  const state = useDiagramStore.getState();
  const diagram = state.diagrams[state.activeDiagramId!]!;
  return planDiagramAutoLayout({
    components: diagram.snapshot.components,
    connections: Object.values(diagram.snapshot.connections),
    nodeLayouts: diagram.nodeLayouts,
    autoRefs: true,
  });
}

describe("applyDiagramAutoLayout with history: false", () => {
  beforeEach(() => {
    // Only the clock: ELK schedules its own work on real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pushes no checkpoint, so one undo takes back the edit and the arrangement", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("Merged history", "context");
    store.openDiagram(diagram.id);
    const a = store.addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.addComponent("system", "B", null, { x: 0, y: 0 });
    const connection = store.addConnection(a.id, b.id, "calls")!;
    // A stored route, so the apply has corridors to reset as well as to write.
    store.setEdgeControlPoints(diagram.id, connection.id, [{ id: "p", x: 50, y: 50 }]);
    vi.setSystemTime(Date.now() + HISTORY_COALESCE_MS + 100);

    const c = useDiagramStore.getState().addComponent("system", "C", null, { x: 0, y: 0 });
    useDiagramStore.getState().addConnection(b.id, c.id, "writes");
    const pastAfterEdit = useDiagramStore.getState().past.length;
    // Past the coalescing window: only `history: false` keeps the run in the step.
    vi.setSystemTime(Date.now() + HISTORY_COALESCE_MS + 100);

    const plan = await planActive();
    applyDiagramAutoLayout(plan, diagram.id, { history: false });
    expect(useDiagramStore.getState().past.length).toBe(pastAfterEdit);

    const arranged = useDiagramStore.getState().diagrams[diagram.id]!;
    expect(arranged.nodeLayouts[c.id]!.x).toBeGreaterThan(arranged.nodeLayouts[b.id]!.x);

    useDiagramStore.getState().undo();
    const undone = useDiagramStore.getState().diagrams[diagram.id]!;
    expect(undone.snapshot.components[c.id]).toBeDefined();
    expect(Object.keys(undone.snapshot.connections)).toHaveLength(1);
    expect(undone.nodeLayouts[a.id]).toMatchObject({ x: 0, y: 0 });
  });
});
