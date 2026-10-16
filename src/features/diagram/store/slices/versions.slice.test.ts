import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";
import { VERSION_COLOR_PALETTE } from "../../utils/version.utils";

function setup() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Versions", "container");
  store.getState().openDiagram(diagram.id);
  const d = () => store.getState().diagrams[diagram.id];
  const past = () => store.getState().past.length;
  return { store, d, past };
}

describe("addVersion", () => {
  it("creates an empty version with a palette colour and names it as given", () => {
    const { store, d } = setup();
    const version = store.getState().addVersion("  Proposal  ");
    expect(version).toMatchObject({
      name: "Proposal",
      color: VERSION_COLOR_PALETTE[0],
      addedComponents: {},
      addedConnections: {},
      removedComponentIds: [],
      removedConnectionIds: [],
      nodeLayouts: {},
    });
    expect(d().versions![version.id]).toEqual(version);
  });

  it("numbers a blank name after the versions already there", () => {
    const { store } = setup();
    store.getState().addVersion("First");
    const second = store.getState().addVersion("   ");
    expect(second.name).not.toBe("");
    expect(second.color).toBe(VERSION_COLOR_PALETTE[1 % VERSION_COLOR_PALETTE.length]);
  });

  it("wraps the colours round the palette", () => {
    const { store } = setup();
    let last = store.getState().addVersion("v0");
    for (let i = 1; i <= VERSION_COLOR_PALETTE.length; i += 1) {
      last = store.getState().addVersion(`v${i}`);
    }
    expect(last.color).toBe(VERSION_COLOR_PALETTE[0]);
  });
});

describe("duplicateVersion", () => {
  it("copies the version deeply under a new id, name and colour", () => {
    const { store, d } = setup();
    const src = store.getState().addVersion("Proposal");
    const node = store.getState().addComponent("system", "Scene only", null, { x: 0, y: 0 });
    store.getState().setActiveVersion(src.id);
    const own = store.getState().addComponent("system", "Own", null, { x: 5, y: 5 });
    const copy = store.getState().duplicateVersion(src.id, "Copy")!;
    expect(copy.id).not.toBe(src.id);
    expect(copy.name).toBe("Copy");
    expect(copy.addedComponents[own.id]).toBeDefined();
    // Deep: editing the copy leaves the source alone.
    store.setState((state) => {
      state.diagrams[state.activeDiagramId!].versions![copy.id].addedComponents[own.id].name = "X";
    });
    expect(d().versions![src.id].addedComponents[own.id].name).toBe("Own");
    expect(node.id).toBeDefined();
  });

  it("falls back to a localized default name, and refuses an unknown source", () => {
    const { store } = setup();
    const src = store.getState().addVersion("Proposal");
    const copy = store.getState().duplicateVersion(src.id)!;
    expect(copy.name.length).toBeGreaterThan(0);
    expect(store.getState().duplicateVersion("ghost")).toBeNull();
  });
});

describe("setActiveVersion", () => {
  it("clears the comparison and ignores an unknown version", () => {
    const { store, d } = setup();
    const a = store.getState().addVersion("A");
    const b = store.getState().addVersion("B");
    store.getState().setActiveVersion(a.id);
    store.getState().setCompareVersion(b.id);
    expect(d().compareVersionId).toBe(b.id);
    store.getState().setActiveVersion("ghost");
    expect(d().activeVersionId).toBe(a.id);
    expect(d().compareVersionId).toBe(b.id);
    store.getState().setActiveVersion(b.id);
    expect(d().compareVersionId).toBeNull();
  });

  it("keeps each version's own viewport and restores it on return", () => {
    const { store, d } = setup();
    const a = store.getState().addVersion("A");
    const b = store.getState().addVersion("B");
    store.getState().setActiveVersion(a.id);
    store.getState().updateViewport({ x: 11, y: 22, zoom: 2 });
    store.getState().setActiveVersion(b.id);
    // B has no viewport of its own yet, so the canvas keeps the current one.
    expect(d().viewport).toEqual({ x: 11, y: 22, zoom: 2 });
    store.getState().updateViewport({ x: 99, y: 88, zoom: 0.5 });
    store.getState().setActiveVersion(a.id);
    expect(d().viewport).toEqual({ x: 11, y: 22, zoom: 2 });
    store.getState().setActiveVersion(b.id);
    expect(d().viewport).toEqual({ x: 99, y: 88, zoom: 0.5 });
  });

  it("leaving every version (null) shows the base again", () => {
    const { store, d } = setup();
    const a = store.getState().addVersion("A");
    store.getState().setActiveVersion(a.id);
    store.getState().setActiveVersion(null);
    expect(d().activeVersionId).toBeNull();
  });
});

describe("setCompareVersion", () => {
  it("needs an active version, compares another one, and never itself", () => {
    const { store, d } = setup();
    const a = store.getState().addVersion("A");
    const b = store.getState().addVersion("B");
    store.getState().setCompareVersion(b.id);
    expect(d().compareVersionId ?? null).toBeNull();
    store.getState().setActiveVersion(a.id);
    store.getState().setCompareVersion(a.id);
    expect(d().compareVersionId ?? null).toBeNull();
    store.getState().setCompareVersion("ghost");
    expect(d().compareVersionId ?? null).toBeNull();
    store.getState().setCompareVersion(b.id);
    expect(d().compareVersionId).toBe(b.id);
    store.getState().setCompareVersion(null);
    expect(d().compareVersionId).toBeNull();
  });
});

describe("renameVersion", () => {
  it("trims the name and ignores a blank one", () => {
    const { store, d } = setup();
    const a = store.getState().addVersion("A");
    store.getState().renameVersion(a.id, "  Renamed ");
    expect(d().versions![a.id].name).toBe("Renamed");
    store.getState().renameVersion(a.id, "   ");
    expect(d().versions![a.id].name).toBe("Renamed");
  });
});

describe("removeVersion", () => {
  it("drops the version, resets active and compare pointers, and clears an empty map", () => {
    const { store, d } = setup();
    const a = store.getState().addVersion("A");
    store.getState().setActiveVersion(a.id);
    store.getState().removeVersion(a.id);
    expect(d().versions).toBeUndefined();
    expect(d().activeVersionId).toBeNull();
  });

  it("keeps the other versions, and the pointer when it names one of them", () => {
    const { store, d } = setup();
    const a = store.getState().addVersion("A");
    const b = store.getState().addVersion("B");
    store.getState().setActiveVersion(a.id);
    store.getState().removeVersion(b.id);
    expect(Object.keys(d().versions!)).toEqual([a.id]);
    expect(d().activeVersionId).toBe(a.id);
  });

  it("is one undo step, and ignores an unknown id without history", () => {
    const { store, d, past } = setup();
    const a = store.getState().addVersion("A");
    const before = past();
    store.getState().removeVersion("ghost");
    expect(past()).toBe(before);
    store.getState().removeVersion(a.id);
    store.getState().undo();
    expect(d().versions![a.id]).toBeDefined();
  });
});

describe("what a version holds", () => {
  it("addComponentToVersion stores the component and a layout keyed to it", () => {
    const { store, d } = setup();
    const v = store.getState().addVersion("A");
    store
      .getState()
      .addComponentToVersion(
        v.id,
        { id: "c1", name: "Cache", description: "", parentId: null, type: "system" },
        { elementId: "other", x: 10, y: 20 },
      );
    expect(d().versions![v.id].addedComponents.c1.name).toBe("Cache");
    expect(d().versions![v.id].nodeLayouts.c1).toEqual({ elementId: "c1", x: 10, y: 20 });
  });

  it("addConnectionToVersion refuses an endpoint that cannot take it, before history", () => {
    const { store, d, past } = setup();
    const v = store.getState().addVersion("A");
    const note = store.getState().addComponent("note", "Note", null, { x: 0, y: 0 });
    const sys = store.getState().addComponent("system", "Sys", null, { x: 0, y: 100 });
    const before = past();
    store.getState().addConnectionToVersion(v.id, {
      id: "k1",
      sourceId: note.id,
      targetId: sys.id,
      label: "",
    });
    expect(d().versions![v.id].addedConnections.k1).toBeUndefined();
    expect(past()).toBe(before);
    store.getState().addConnectionToVersion(v.id, {
      id: "k2",
      sourceId: sys.id,
      targetId: sys.id,
      label: "",
    });
    expect(d().versions![v.id].addedConnections.k2).toBeDefined();
  });

  it("updateVersionNodeLayout moves and resizes a layout the version has, and only that", () => {
    const { store, d } = setup();
    const v = store.getState().addVersion("A");
    store
      .getState()
      .addComponentToVersion(
        v.id,
        { id: "c1", name: "Cache", description: "", parentId: null, type: "system" },
        { elementId: "c1", x: 0, y: 0 },
      );
    store.getState().updateVersionNodeLayout(v.id, "c1", { x: 5, y: 6 }, { width: 70, height: 80 });
    expect(d().versions![v.id].nodeLayouts.c1).toMatchObject({ x: 5, y: 6, width: 70, height: 80 });
    store.getState().updateVersionNodeLayout(v.id, "ghost", { x: 1, y: 1 });
    expect(d().versions![v.id].nodeLayouts.ghost).toBeUndefined();
  });
});

describe("mergeVersionIntoBase", () => {
  function twoVersions() {
    const ctx = setup();
    const base = ctx.store.getState().addComponent("system", "Legacy", null, { x: 0, y: 0 });
    const a = ctx.store.getState().addVersion("A");
    const b = ctx.store.getState().addVersion("B");
    ctx.store.getState().setActiveVersion(a.id);
    const added = ctx.store.getState().addComponent("system", "New", null, { x: 40, y: 40 });
    const other = ctx.store.getState().addComponent("system", "Peer", null, { x: 90, y: 90 });
    ctx.store.getState().addConnection(added.id, other.id, "uses");
    ctx.store.getState().removeComponent(base.id);
    return { ...ctx, base, a, b, added, other };
  }

  it("moves what the version added into the base and removes what it hid", () => {
    const ctx = twoVersions();
    ctx.store.getState().mergeVersionIntoBase(ctx.a.id);
    const snapshot = ctx.d().snapshot;
    expect(snapshot.components[ctx.added.id]).toBeDefined();
    expect(snapshot.components[ctx.other.id]).toBeDefined();
    expect(snapshot.components[ctx.base.id]).toBeUndefined();
    expect(ctx.d().nodeLayouts[ctx.added.id]).toMatchObject({ x: 40, y: 40 });
    expect(ctx.d().nodeLayouts[ctx.base.id]).toBeUndefined();
    expect(Object.values(snapshot.connections)).toHaveLength(1);
  });

  it("consumes the version, and with it the active pointer", () => {
    const ctx = twoVersions();
    ctx.store.getState().mergeVersionIntoBase(ctx.a.id);
    expect(ctx.d().versions![ctx.a.id]).toBeUndefined();
    expect(ctx.d().versions![ctx.b.id]).toBeDefined();
    expect(ctx.d().activeVersionId).toBeNull();
  });

  it("clears the versions map when the merged one was the last", () => {
    const ctx = setup();
    const a = ctx.store.getState().addVersion("A");
    ctx.store.getState().mergeVersionIntoBase(a.id);
    expect(ctx.d().versions).toBeUndefined();
  });

  it("scrubs the merged ids from the other versions", () => {
    const ctx = twoVersions();
    ctx.store.setState((state) => {
      const other = state.diagrams[state.activeDiagramId!].versions![ctx.b.id];
      other.removedComponentIds.push(ctx.base.id);
      other.addedComponents[ctx.added.id] = {
        ...ctx.added,
      } as (typeof other.addedComponents)[string];
      other.nodeLayouts[ctx.added.id] = { elementId: ctx.added.id, x: 1, y: 1 };
    });
    ctx.store.getState().mergeVersionIntoBase(ctx.a.id);
    const b = ctx.d().versions![ctx.b.id];
    expect(b.removedComponentIds).not.toContain(ctx.base.id);
    expect(b.addedComponents[ctx.added.id]).toBeUndefined();
    expect(b.nodeLayouts[ctx.added.id]).toBeUndefined();
  });

  it("is one undo step, and ignores an unknown version", () => {
    const ctx = twoVersions();
    ctx.store.getState().mergeVersionIntoBase("ghost");
    expect(ctx.d().versions![ctx.a.id]).toBeDefined();
    ctx.store.getState().mergeVersionIntoBase(ctx.a.id);
    ctx.store.getState().undo();
    expect(ctx.d().versions![ctx.a.id]).toBeDefined();
    expect(ctx.d().snapshot.components[ctx.added.id]).toBeUndefined();
  });
});
