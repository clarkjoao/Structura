import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPersistStoragePayload } from "../persist.config";
import { HISTORY_COALESCE_MS } from "../store.constants";
import { createTestDiagramStore } from "../test-utils";

/**
 * `applyAutoLayout` is what every layout run writes through, so two properties
 * are load-bearing and neither was true of the path the LLM used to take:
 *
 *   - a whole run is one undo step, not one per node;
 *   - a container's new size is written, and survives being reopened.
 */

function setupDiagram() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Layout", "context");
  store.getState().openDiagram(diagram.id);

  const panel = store.getState().addComponent("panel", "P", null, { x: 10, y: 10 });
  const a = store.getState().addComponent("system", "A", null, { x: 20, y: 20 });
  const b = store.getState().addComponent("system", "B", null, { x: 30, y: 30 });

  // Past the coalescing window, so the layout run records its own checkpoint
  // instead of folding into the one the inserts pushed.
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

  return { store, diagramId: diagram.id, ids: [panel.id, a.id, b.id] as const };
}

function layoutsOf(store: ReturnType<typeof createTestDiagramStore>, diagramId: string) {
  return store.getState().diagrams[diagramId]!.nodeLayouts;
}

describe("applyAutoLayout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is one undo step for the whole run, however many nodes moved", () => {
    const { store, diagramId, ids } = setupDiagram();
    const [panelId, aId, bId] = ids;

    const before = ids.map((id) => ({ ...layoutsOf(store, diagramId)[id]! }));

    store.getState().applyAutoLayout([
      { elementId: panelId, x: 900, y: 900, width: 1200, height: 800 },
      { elementId: aId, x: 1000, y: 1000 },
      { elementId: bId, x: 1100, y: 1100 },
    ]);

    expect(layoutsOf(store, diagramId)[aId]!.x).toBe(1000);
    expect(layoutsOf(store, diagramId)[bId]!.x).toBe(1100);
    expect(layoutsOf(store, diagramId)[panelId]!.width).toBe(1200);

    const pastLength = store.getState().past.length;
    store.getState().undo();

    // A single undo, and every node is back — not just the last one written.
    for (const [index, id] of ids.entries()) {
      const restored = layoutsOf(store, diagramId)[id]!;
      expect(restored.x, `${id} x`).toBe(before[index].x);
      expect(restored.y, `${id} y`).toBe(before[index].y);
      expect(restored.width, `${id} width`).toBe(before[index].width);
      expect(restored.height, `${id} height`).toBe(before[index].height);
    }
    expect(store.getState().past.length).toBe(pastLength - 1);
  });

  it("stores the size it is given, and it survives being saved and reopened", () => {
    const { store, diagramId, ids } = setupDiagram();
    const [panelId] = ids;

    store
      .getState()
      .applyAutoLayout([{ elementId: panelId, x: 0, y: 0, width: 1460, height: 501 }]);

    // What the storage port actually writes and reads back.
    const reopened = JSON.parse(JSON.stringify(buildPersistStoragePayload(store.getState())));
    const layout = reopened.state.diagrams[diagramId].nodeLayouts[panelId];

    expect(layout.width).toBe(1460);
    expect(layout.height).toBe(501);
  });

  it("leaves a stored size alone when the caller passes no size", () => {
    const { store, diagramId, ids } = setupDiagram();
    const [panelId] = ids;

    store.getState().applyAutoLayout([{ elementId: panelId, x: 0, y: 0, width: 640, height: 480 }]);
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    store.getState().applyAutoLayout([{ elementId: panelId, x: 50, y: 60 }]);

    const layout = layoutsOf(store, diagramId)[panelId]!;
    expect(layout.x).toBe(50);
    expect(layout.y).toBe(60);
    expect(layout.width).toBe(640);
    expect(layout.height).toBe(480);
  });
});
