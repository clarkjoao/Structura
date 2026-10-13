import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedCanvasSnapshot, type Diagram } from "@/features/diagram";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { applySuggestion } from "./suggestion-apply";
import type { DiagramToolHost } from "./tools/host";
import { createInternalToolRegistry } from "./tools/internal-tools";
import { SuggestionDraft } from "./tools/suggestion-draft";

function setup() {
  const store = createTestDiagramStore();
  const created = store.getState().addDiagram("Suggestion", "container");
  store.getState().openDiagram(created.id);
  const api = store.getState().addComponent("container", "API", null, { x: 0, y: 0 });
  const db = store.getState().addComponent("container", "DB", null, { x: 300, y: 0 });
  vi.advanceTimersByTime(5000);

  const readDiagram = (): Diagram | null => {
    const d = store.getState().diagrams[created.id];
    if (!d) return null;
    const resolved = getCachedCanvasSnapshot(d);
    return {
      ...d,
      snapshot: {
        ...d.snapshot,
        components: resolved.components,
        connections: resolved.connections,
      },
    };
  };
  const layoutRuns = vi.fn(async () => undefined);
  const host: DiagramToolHost = {
    readDiagram,
    applyChanges: (changes) => store.getState().applyChangeBatch(changes),
    autoLayout: layoutRuns,
  };
  const snapshot = () => JSON.stringify(readDiagram()?.snapshot);
  const draft = new SuggestionDraft();
  const registry = createInternalToolRegistry();
  const call = (name: string, input: unknown) =>
    registry.get(name)?.execute(input, { host, suggestion: draft });
  return { store, host, api, db, draft, call, snapshot, layoutRuns };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("one suggestion per turn, applied on Accept as one undo step", () => {
  it("N write calls -> nothing applied -> Accept is one undo step that undo restores", async () => {
    const { store, host, api, db, draft, call, snapshot, layoutRuns } = setup();
    const before = snapshot();
    const pastBefore = store.getState().past.length;

    call("add_node", { nodeType: "container", name: "Cache", parentId: null });
    call("add_edge", { sourceId: api.id, targetId: "new-1", label: "reads" });
    call("update_node", { nodeId: db.id, patch: { name: "Orders DB" } });
    call("auto_layout", {});

    // Nothing touches the diagram before Accept.
    expect(snapshot()).toBe(before);
    expect(store.getState().past.length).toBe(pastBefore);

    const skipped = await applySuggestion(draft.actions, host);
    expect(skipped).toEqual([]);
    expect(snapshot()).not.toBe(before);
    expect(store.getState().past.length).toBe(pastBefore + 1);
    expect(layoutRuns).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    store.getState().undo();
    expect(snapshot()).toBe(before);
  });

  it("Reject is a no-op: not applying the draft leaves the diagram untouched", () => {
    const { store, call, snapshot, api } = setup();
    const before = snapshot();
    const pastBefore = store.getState().past.length;
    call("remove_node", { nodeId: api.id });
    expect(snapshot()).toBe(before);
    expect(store.getState().past.length).toBe(pastBefore);
  });

  it("skips actions whose target was deleted meanwhile and applies the rest", async () => {
    const { store, host, api, db, draft, call } = setup();
    call("update_node", { nodeId: api.id, patch: { name: "Public API" } });
    call("remove_node", { nodeId: db.id });
    store.getState().removeComponent(db.id);
    vi.advanceTimersByTime(5000);
    const pastBefore = store.getState().past.length;

    const skipped = await applySuggestion(draft.actions, host);

    expect(skipped).toEqual([{ actionIndex: 1, reason: "missingNode" }]);
    expect(host.readDiagram()?.snapshot.components[api.id]?.name).toBe("Public API");
    expect(store.getState().past.length).toBe(pastBefore + 1);
  });
});
