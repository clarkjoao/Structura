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
    takeReceipt: (checkpoint) => store.getState().takeChangeBatchReceipt(checkpoint),
    revertChanges: (receipt) => store.getState().revertChangeBatch(receipt),
    isInHistory: (receipt) => store.getState().isChangeBatchInHistory(receipt),
    removeElements: (nodeIds, edgeIds) => store.getState().removeElements(nodeIds, edgeIds),
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

    const { skipped } = await applySuggestion(draft.actions, host);
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

    const { skipped } = await applySuggestion(draft.actions, host);

    expect(skipped).toEqual([{ actionIndex: 1, reason: "missingNode" }]);
    expect(host.readDiagram()?.snapshot.components[api.id]?.name).toBe("Public API");
    expect(store.getState().past.length).toBe(pastBefore + 1);
  });
});

describe("preview: a suggestion drawn before Accept can be taken back as one step", () => {
  it("reports what it added and reverts to the state before, with nothing to redo", async () => {
    const { store, host, api, draft, call, snapshot } = setup();
    const before = snapshot();
    const pastBefore = store.getState().past.length;
    call("add_node", { nodeType: "container", name: "Cache", parentId: null });
    call("add_edge", { sourceId: api.id, targetId: "new-1", label: "reads" });

    const applied = await applySuggestion(draft.actions, host);
    expect(applied.addedNodeIds).toHaveLength(1);
    expect(applied.addedEdgeIds).toHaveLength(1);
    expect(applied.receipt).not.toBeNull();
    expect(host.isInHistory(applied.receipt!)).toBe(true);

    expect(host.revertChanges(applied.receipt!)).toBe(true);
    expect(snapshot()).toBe(before);
    expect(store.getState().past.length).toBe(pastBefore);
    expect(store.getState().future).toEqual([]);
    expect(host.isInHistory(applied.receipt!)).toBe(false);
  });

  it("does not revert once the diagram changed after the preview", async () => {
    const { store, host, draft, call, snapshot } = setup();
    call("add_node", { nodeType: "container", name: "Cache", parentId: null });
    const applied = await applySuggestion(draft.actions, host);
    vi.advanceTimersByTime(5000);
    store.getState().addComponent("container", "Manual", null, { x: 600, y: 0 });
    const afterEdit = snapshot();

    expect(host.revertChanges(applied.receipt!)).toBe(false);
    expect(snapshot()).toBe(afterEdit);
    expect(host.isInHistory(applied.receipt!)).toBe(true);
  });

  it("is no longer in history once the user undoes it", async () => {
    const { store, host, draft, call } = setup();
    call("add_node", { nodeType: "container", name: "Cache", parentId: null });
    const applied = await applySuggestion(draft.actions, host);
    vi.advanceTimersByTime(100);
    store.getState().undo();
    expect(host.isInHistory(applied.receipt!)).toBe(false);
  });

  it("builds a panel of the requested kind (VPC) and nests a node in it", async () => {
    const { host, draft, call } = setup();
    call("add_node", { nodeType: "panel", name: "VPC", parentId: null, panelKind: "vpc" });
    call("add_node", { nodeType: "container", name: "App", parentId: "new-1" });
    const applied = await applySuggestion(draft.actions, host);
    const components = host.readDiagram()!.snapshot.components;
    const [vpcId, appId] = applied.addedNodeIds.sort((a, b) =>
      components[a]!.type === "panel" ? -1 : components[b]!.type === "panel" ? 1 : 0,
    );
    expect(components[vpcId!]).toMatchObject({ type: "panel", panelKind: "vpc" });
    expect(components[appId!]?.parentId).toBe(vpcId);
  });

  it("refuses panelKind on a node that is not a panel", () => {
    const { call, draft } = setup();
    const result = call("add_node", {
      nodeType: "container",
      name: "App",
      parentId: null,
      panelKind: "vpc",
    });
    expect(result).toMatchObject({ error: expect.stringContaining("panelKind") });
    expect(draft.isEmpty).toBe(true);
  });

  it("lays out a suggestion that adds several unplaced nodes, even without auto_layout", async () => {
    const { host, draft, call, layoutRuns } = setup();
    call("add_node", { nodeType: "container", name: "A", parentId: null });
    call("add_node", { nodeType: "container", name: "B", parentId: null });
    await applySuggestion(draft.actions, host);
    expect(layoutRuns).toHaveBeenCalledTimes(1);
  });

  it("leaves the layout alone for a single new node", async () => {
    const { host, draft, call, layoutRuns } = setup();
    call("add_node", { nodeType: "container", name: "A", parentId: null });
    await applySuggestion(draft.actions, host);
    expect(layoutRuns).not.toHaveBeenCalled();
  });
});
