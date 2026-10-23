import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore } from "@/features/diagram";
import { HISTORY_COALESCE_MS } from "@/features/diagram/store/store.constants";
import { layoutScopedNodes } from "./layoutScopedNodes";

/**
 * An import that brings its own direction into an empty diagram (a Mermaid
 * `flowchart TD`) stores it with its layout, as one undo step (ADR-0013).
 */
describe("layoutScopedNodes with a direction", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lays out top-to-bottom and stores the direction in the same step", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("Imported TD", "context");
    store.openDiagram(diagram.id);
    const a = store.addComponent("system", "A", null, { x: 0, y: 0 });
    const b = store.addComponent("system", "B", null, { x: 0, y: 0 });
    const ab = store.addConnection(a.id, b.id, "next")!;
    vi.setSystemTime(Date.now() + HISTORY_COALESCE_MS + 100);

    const state = useDiagramStore.getState();
    const current = state.diagrams[diagram.id]!;
    await layoutScopedNodes({
      nodeIds: [a.id, b.id],
      connectionIds: [ab.id],
      components: current.snapshot.components,
      connections: current.snapshot.connections,
      nodeLayouts: current.nodeLayouts,
      anchor: { x: 0, y: 0 },
      activeDiagramId: diagram.id,
      applyAutoLayout: state.applyAutoLayout,
      direction: "TB",
      writeDirection: true,
    });

    const laidOut = useDiagramStore.getState().diagrams[diagram.id]!;
    expect(laidOut.direction).toBe("TB");
    expect(laidOut.nodeLayouts[b.id]!.y).toBeGreaterThan(laidOut.nodeLayouts[a.id]!.y);

    useDiagramStore.getState().undo();
    expect("direction" in useDiagramStore.getState().diagrams[diagram.id]!).toBe(false);
  });
});
