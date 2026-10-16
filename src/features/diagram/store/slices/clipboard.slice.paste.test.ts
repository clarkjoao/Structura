import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";

function setup() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Clipboard", "container");
  store.getState().openDiagram(diagram.id);
  const d = () => store.getState().diagrams[diagram.id];
  const add = (
    type: Parameters<ReturnType<typeof store.getState>["addComponent"]>[0],
    name: string,
    x: number,
    y: number,
    parentId: string | null = null,
  ) => store.getState().addComponent(type, name, parentId, { x, y });
  return { store, d, add, past: () => store.getState().past.length };
}

describe("copyToClipboard", () => {
  it("keeps the components asked for, the connections between them, and their relative offsets", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 100, 200);
    const b = ctx.add("system", "B", 400, 260);
    const c = ctx.add("system", "C", 0, 0);
    ctx.store.getState().addConnection(a.id, b.id, "uses");
    ctx.store.getState().addConnection(b.id, c.id, "outside");
    ctx.store.getState().copyToClipboard([a.id, b.id]);
    const clip = ctx.store.getState().clipboard!;
    expect(clip.components.map((x) => x.id)).toEqual([a.id, b.id]);
    // Only the connection with both ends in the selection travels.
    expect(clip.connections).toHaveLength(1);
    expect(clip.relativeOffsets).toEqual([
      { dx: 0, dy: 0 },
      { dx: 300, dy: 60 },
    ]);
  });

  it("measures offsets from absolute positions, through parents", () => {
    const ctx = setup();
    const panel = ctx.add("panel", "P", 1000, 1000);
    const inner = ctx.add("system", "In", 1100, 1100);
    ctx.store.getState().setParent(inner.id, panel.id);
    const loose = ctx.add("system", "Loose", 1300, 1250);
    ctx.store.getState().copyToClipboard([inner.id, loose.id]);
    expect(ctx.store.getState().clipboard!.relativeOffsets).toEqual([
      { dx: 0, dy: 0 },
      { dx: 200, dy: 150 },
    ]);
  });

  it("skips ids that are not in the diagram, and holds nothing for an empty copy", () => {
    const ctx = setup();
    ctx.store.getState().copyToClipboard(["ghost"]);
    expect(ctx.store.getState().clipboard).toEqual({
      components: [],
      connections: [],
      relativeOffsets: [],
    });
  });

  it("is a snapshot: editing the original afterwards does not change what was copied", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    ctx.store.getState().copyToClipboard([a.id]);
    ctx.store.getState().updateComponent(a.id, { name: "Renamed" });
    expect(ctx.store.getState().clipboard!.components[0].name).toBe("A");
  });
});

describe("pasteFromClipboard", () => {
  it("returns nothing and writes nothing when the clipboard is empty", () => {
    const ctx = setup();
    const before = ctx.past();
    expect(ctx.store.getState().pasteFromClipboard()).toEqual([]);
    expect(ctx.past()).toBe(before);
  });

  it("pastes copies under new ids at the position, keeping the shape of the selection", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 100, 100);
    const b = ctx.add("system", "B", 250, 180);
    ctx.store.getState().copyToClipboard([a.id, b.id]);
    const ids = ctx.store.getState().pasteFromClipboard({ x: 1000, y: 2000 });
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(a.id);
    expect(ctx.d().snapshot.components[ids[0]].name).toBe("A");
    expect(ctx.d().nodeLayouts[ids[0]]).toMatchObject({ x: 1000, y: 2000 });
    expect(ctx.d().nodeLayouts[ids[1]]).toMatchObject({ x: 1150, y: 2080 });
  });

  it("defaults to (300, 300) and can be pasted again", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    ctx.store.getState().copyToClipboard([a.id]);
    const first = ctx.store.getState().pasteFromClipboard();
    const second = ctx.store.getState().pasteFromClipboard();
    expect(ctx.d().nodeLayouts[first[0]]).toMatchObject({ x: 300, y: 300 });
    expect(first[0]).not.toBe(second[0]);
  });

  it("rewires the connections between pasted components to the new ids", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    const b = ctx.add("system", "B", 200, 0);
    ctx.store.getState().addConnection(a.id, b.id, "uses");
    ctx.store.getState().copyToClipboard([a.id, b.id]);
    const [na, nb] = ctx.store.getState().pasteFromClipboard({ x: 0, y: 500 });
    const pasted = Object.values(ctx.d().snapshot.connections).filter(
      (c) => c.sourceId === na && c.targetId === nb,
    );
    expect(pasted).toHaveLength(1);
    expect(Object.values(ctx.d().snapshot.connections)).toHaveLength(2);
  });

  it("makes a pasted child of a pasted parent relative to it", () => {
    const ctx = setup();
    const panel = ctx.add("panel", "P", 100, 100);
    const child = ctx.add("system", "C", 160, 170);
    ctx.store.getState().setParent(child.id, panel.id);
    ctx.store.getState().copyToClipboard([panel.id, child.id]);
    const [np, nc] = ctx.store.getState().pasteFromClipboard({ x: 800, y: 800 });
    expect(ctx.d().snapshot.components[nc].parentId).toBe(np);
    // Child sits 60/70 inside the panel, as it did.
    expect(ctx.d().nodeLayouts[nc]).toMatchObject({ x: 60, y: 70 });
    expect(ctx.d().nodeLayouts[np]).toMatchObject({ x: 800, y: 800 });
  });

  it("drops the parent when only the child was copied, unless asked to keep it", () => {
    const ctx = setup();
    const panel = ctx.add("panel", "P", 100, 100);
    const child = ctx.add("system", "C", 160, 170);
    ctx.store.getState().setParent(child.id, panel.id);
    ctx.store.getState().copyToClipboard([child.id]);
    const [detached] = ctx.store.getState().pasteFromClipboard({ x: 0, y: 0 });
    expect(ctx.d().snapshot.components[detached].parentId).toBeNull();
    const [kept] = ctx.store
      .getState()
      .pasteFromClipboard({ x: 0, y: 0 }, { preserveParentWhenMissing: true });
    expect(ctx.d().snapshot.components[kept].parentId).toBe(panel.id);
  });

  it("does not keep a parent the container refuses", () => {
    const ctx = setup();
    const panel = ctx.add("panel", "P", 0, 0);
    const child = ctx.add("system", "C", 10, 10);
    ctx.store.getState().setParent(child.id, panel.id);
    ctx.store.getState().copyToClipboard([child.id]);
    // The parent is now a person, which takes no children.
    ctx.store.setState((state) => {
      state.diagrams[state.activeDiagramId!].snapshot.components[panel.id].type = "person";
    });
    const [pasted] = ctx.store
      .getState()
      .pasteFromClipboard({ x: 0, y: 0 }, { preserveParentWhenMissing: true });
    expect(ctx.d().snapshot.components[pasted].parentId).toBeNull();
  });

  it("is one structural undo step", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    ctx.store.getState().copyToClipboard([a.id]);
    const ids = ctx.store.getState().pasteFromClipboard();
    ctx.store.getState().undo();
    expect(ctx.d().snapshot.components[ids[0]]).toBeUndefined();
    expect(ctx.d().snapshot.components[a.id]).toBeDefined();
  });

  it("pastes into a version scene, leaving the base alone", () => {
    const ctx = setup();
    const a = ctx.add("system", "A", 0, 0);
    const b = ctx.add("system", "B", 100, 0);
    ctx.store.getState().addConnection(a.id, b.id, "uses");
    ctx.store.getState().copyToClipboard([a.id, b.id]);
    const scene = ctx.store.getState().addVersion("Proposal");
    ctx.store.getState().setActiveVersion(scene.id);
    const ids = ctx.store.getState().pasteFromClipboard({ x: 50, y: 50 });
    const version = ctx.d().versions![scene.id];
    expect(ids.every((id) => version.addedComponents[id])).toBe(true);
    expect(ids.every((id) => !ctx.d().snapshot.components[id])).toBe(true);
    expect(Object.keys(version.addedConnections)).toHaveLength(1);
    expect(Object.keys(ctx.d().snapshot.connections)).toHaveLength(1);
  });
});

describe("clearClipboard and hydrateClipboard", () => {
  it("hold and release an entry as given", () => {
    const ctx = setup();
    const entry = { components: [], connections: [], relativeOffsets: [] };
    ctx.store.getState().hydrateClipboard(entry);
    expect(ctx.store.getState().clipboard).toEqual(entry);
    ctx.store.getState().clearClipboard();
    expect(ctx.store.getState().clipboard).toBeNull();
  });
});

describe("importDrawioResult", () => {
  it("adds components, their layouts and the connections, one undo step, and returns the ids", () => {
    const ctx = setup();
    const before = ctx.past();
    const ids = ctx.store.getState().importDrawioResult(
      [
        { id: "x1", name: "X1", description: "", parentId: null, type: "system" },
        { id: "x2", name: "X2", description: "", parentId: null, type: "system" },
      ],
      [{ id: "k1", sourceId: "x1", targetId: "x2", label: "" }],
      [{ elementId: "whatever", x: 5, y: 6 }],
    );
    expect(ids).toEqual(["x1", "x2"]);
    expect(ctx.d().snapshot.connections.k1).toBeDefined();
    // The layout is keyed to the component at its index; a missing one is simply absent.
    expect(ctx.d().nodeLayouts.x1).toEqual({ elementId: "x1", x: 5, y: 6 });
    expect(ctx.d().nodeLayouts.x2).toBeUndefined();
    expect(ctx.past()).toBe(before + 1);
    ctx.store.getState().undo();
    expect(ctx.d().snapshot.components.x1).toBeUndefined();
  });
});

describe("importMermaidSequenceResult", () => {
  it("adds the cast, the messages and a flow wired to them, and returns the flow id", () => {
    const ctx = setup();
    const flowId = ctx.store
      .getState()
      .importMermaidSequenceResult(
        [{ id: "s1", name: "Service", description: "", parentId: null, type: "system" }],
        [],
        { st1: { id: "st1", type: "action", componentId: "s1" } },
        "st1",
        "Checkout",
        [{ elementId: "s1", x: 1, y: 2 }],
      );
    const flow = ctx.d().snapshot.flows[flowId];
    expect(flow).toMatchObject({
      name: "Checkout",
      entryStepId: "st1",
      mermaid: "",
      diagramId: ctx.d().id,
    });
    expect(ctx.d().nodeLayouts.s1).toMatchObject({ x: 1, y: 2 });
  });
});
