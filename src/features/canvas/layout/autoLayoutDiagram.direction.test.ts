import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore } from "@/features/diagram";
import { HISTORY_COALESCE_MS } from "@/features/diagram/store/store.constants";
import { applyDiagramAutoLayout, planDiagramAutoLayout } from "./autoLayoutDiagram";

/**
 * Switching a diagram's reading direction is one step (ADR-0013): the field,
 * the arrangement on the new axis and every re-derived route go in together,
 * and one undo puts the old axis, positions and routes back.
 */
describe("switching the reading direction", () => {
  beforeEach(() => {
    // Only the clock: ELK schedules its own work on real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the direction, the layout and the routes as one undo step", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("Direction switch", "context");
    store.openDiagram(diagram.id);
    const a = store.addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.addComponent("system", "B", null, { x: 400, y: 0 });
    const c = store.addComponent("system", "C", null, { x: 800, y: 0 });
    const ab = store.addConnection(a.id, b.id, "calls")!;
    store.addConnection(b.id, c.id, "calls");
    // A hand-tuned route, which the switch re-derives and undo brings back.
    store.setEdgeControlPoints(diagram.id, ab.id, [{ id: "p", x: 200, y: 120 }]);
    vi.setSystemTime(Date.now() + HISTORY_COALESCE_MS + 100);

    const before = structuredClone(useDiagramStore.getState().diagrams[diagram.id]!);
    const plan = await planDiagramAutoLayout({
      components: before.snapshot.components,
      connections: Object.values(before.snapshot.connections),
      nodeLayouts: before.nodeLayouts,
      autoRefs: false,
      direction: "TB",
    });
    applyDiagramAutoLayout(plan, diagram.id, { writeDirection: true });

    const switched = useDiagramStore.getState().diagrams[diagram.id]!;
    expect(switched.direction).toBe("TB");
    expect(switched.nodeLayouts[b.id]!.y).toBeGreaterThan(switched.nodeLayouts[a.id]!.y);
    expect(switched.nodeLayouts[c.id]!.y).toBeGreaterThan(switched.nodeLayouts[b.id]!.y);
    expect(switched.edgeLayouts[ab.id]?.points).not.toEqual([{ id: "p", x: 200, y: 120 }]);

    useDiagramStore.getState().undo();
    const undone = useDiagramStore.getState().diagrams[diagram.id]!;
    expect("direction" in undone).toBe(false);
    expect(undone.nodeLayouts).toEqual(before.nodeLayouts);
    expect(undone.edgeLayouts).toEqual(before.edgeLayouts);
  });
});
