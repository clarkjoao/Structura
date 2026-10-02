import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/features/elements/bootstrap";
import { PanelKind } from "../../enums";
import { HISTORY_COALESCE_MS } from "../store.constants";
import { createTestDiagramStore } from "../test-utils";

/**
 * The auto-layout's references: written in the same step as the positions,
 * kept or dissolved on the next run, never touching the user's own.
 */

function setup() {
  const store = createTestDiagramStore();
  const d = store.getState().addDiagram("Hub", "container");
  store.getState().openDiagram(d.id);
  const s = store.getState();
  const zone1 = s.addComponent(
    "panel",
    "Zone 1",
    null,
    { x: 0, y: 0 },
    undefined,
    PanelKind.Default,
  );
  const zone2 = s.addComponent(
    "panel",
    "Zone 2",
    null,
    { x: 0, y: 600 },
    undefined,
    PanelKind.Default,
  );
  const auth = s.addComponent("container", "Auth", null, { x: 900, y: 300 });
  const a1 = s.addComponent("container", "A1", zone1.id, { x: 20, y: 40 });
  const a2 = s.addComponent("container", "A2", zone1.id, { x: 20, y: 200 });
  const b1 = s.addComponent("container", "B1", zone2.id, { x: 20, y: 40 });
  const c = s.addComponent("container", "C", null, { x: 600, y: 300 });
  const e = {
    a1: s.addConnection(a1.id, auth.id, "login")!,
    a1Again: s.addConnection(a1.id, auth.id, "refresh")!,
    a2: s.addConnection(a2.id, auth.id, "")!,
    b1: s.addConnection(b1.id, auth.id, "")!,
    c: s.addConnection(c.id, auth.id, "")!,
  };
  vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
  const diagram = () => store.getState().diagrams[d.id]!;
  const components = () => diagram().snapshot.components;
  const targetOf = (id: string) => diagram().snapshot.connections[id]!.targetId;
  const position = { elementId: auth.id, x: 900, y: 300 };
  return { store, zone1, zone2, auth, a1, b1, c, e, diagram, components, targetOf, position };
}

describe("applyAutoLayout with automatic references", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("makes the reference, ends every edge from its consumers on it, and positions it", () => {
    const ctx = setup();
    ctx.store.getState().applyAutoLayout(
      [ctx.position, { elementId: "ref-z1", x: 300, y: 80 }],
      [
        {
          refId: "ref-z1",
          originalId: ctx.auth.id,
          parentId: ctx.zone1.id,
          sourceIds: [ctx.a1.id],
        },
      ],
    );

    expect(ctx.components()["ref-z1"]).toMatchObject({
      type: "shared-ref",
      refOf: ctx.auth.id,
      parentId: ctx.zone1.id,
      auto: true,
    });
    expect(ctx.diagram().nodeLayouts["ref-z1"]).toMatchObject({ x: 300, y: 80 });
    // Both of A1's edges, though the layout graph only saw one of the pair.
    expect(ctx.targetOf(ctx.e.a1.id)).toBe("ref-z1");
    expect(ctx.targetOf(ctx.e.a1Again.id)).toBe("ref-z1");
    // A consumer not assigned keeps its edge on the original.
    expect(ctx.targetOf(ctx.e.a2.id)).toBe(ctx.auth.id);
    expect(ctx.components()[ctx.auth.id].shared).toEqual({ mode: "ref" });
  });

  it("is undone in one step: reference, targets and positions together", () => {
    const ctx = setup();
    ctx.store.getState().applyAutoLayout(
      [{ ...ctx.position, x: 1200 }],
      [
        {
          refId: "ref-z1",
          originalId: ctx.auth.id,
          parentId: ctx.zone1.id,
          sourceIds: [ctx.a1.id],
        },
      ],
    );
    ctx.store.getState().undo();

    expect(ctx.components()["ref-z1"]).toBeUndefined();
    expect(ctx.targetOf(ctx.e.a1.id)).toBe(ctx.auth.id);
    expect(ctx.diagram().nodeLayouts[ctx.auth.id]).toMatchObject({ x: 900 });
    expect(ctx.components()[ctx.auth.id].shared).toBeUndefined();
  });

  it("is its own undo step even right after another edit", () => {
    const ctx = setup();
    // Inside the coalescing window: a soft checkpoint would fold into this edit's.
    const drawn = ctx.store.getState().addConnection(ctx.c.id, ctx.a1.id, "")!;
    ctx.store.getState().applyAutoLayout(
      [ctx.position],
      [
        {
          refId: "ref-z1",
          originalId: ctx.auth.id,
          parentId: ctx.zone1.id,
          sourceIds: [ctx.a1.id],
        },
      ],
    );
    ctx.store.getState().undo();

    expect(ctx.components()["ref-z1"]).toBeUndefined();
    expect(ctx.diagram().snapshot.connections[drawn.id]).toBeDefined();
  });

  it("keeps a reference the next run assigns again, under the same id", () => {
    const ctx = setup();
    const assignment = {
      refId: "ref-z1",
      originalId: ctx.auth.id,
      parentId: ctx.zone1.id,
      sourceIds: [ctx.a1.id],
    };
    ctx.store.getState().applyAutoLayout([ctx.position], [assignment]);
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);
    ctx.store.getState().applyAutoLayout([ctx.position], [assignment]);

    const refs = Object.values(ctx.components()).filter((c) => c.type === "shared-ref");
    expect(refs.map((r) => r.id)).toEqual(["ref-z1"]);
    expect(ctx.targetOf(ctx.e.a1.id)).toBe("ref-z1");
  });

  it("dissolves a reference the next run does not assign back into the original", () => {
    const ctx = setup();
    ctx.store.getState().applyAutoLayout(
      [ctx.position],
      [
        {
          refId: "ref-z1",
          originalId: ctx.auth.id,
          parentId: ctx.zone1.id,
          sourceIds: [ctx.a1.id],
        },
      ],
    );
    // Someone drew an edge out of the reference in between.
    const fromRef = ctx.store.getState().addConnection("ref-z1", ctx.c.id, "")!;
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

    ctx.store.getState().applyAutoLayout([ctx.position], []);

    expect(ctx.components()["ref-z1"]).toBeUndefined();
    expect(ctx.targetOf(ctx.e.a1.id)).toBe(ctx.auth.id);
    expect(ctx.targetOf(ctx.e.a1Again.id)).toBe(ctx.auth.id);
    expect(ctx.diagram().snapshot.connections[fromRef.id]!.sourceId).toBe(ctx.auth.id);
    // Nothing references it any more: it draws its edges again.
    expect(ctx.components()[ctx.auth.id].shared).toBeUndefined();
  });

  it("never touches a reference the user made", () => {
    const ctx = setup();
    const mine = ctx.store.getState().routeConnectionThroughRef(ctx.e.b1.id)!;
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

    ctx.store.getState().applyAutoLayout([ctx.position], []);

    expect(ctx.components()[mine.id]).toMatchObject({ refOf: ctx.auth.id });
    expect(ctx.targetOf(ctx.e.b1.id)).toBe(mine.id);
    expect(ctx.components()[ctx.auth.id].shared).toEqual({ mode: "ref" });
  });

  it("makes no reference while a scene is open", () => {
    const ctx = setup();
    const scene = ctx.store.getState().addVersion("Scene");
    ctx.store.getState().setActiveVersion(scene.id);
    ctx.store.getState().applyAutoLayout(
      [ctx.position],
      [
        {
          refId: "ref-z1",
          originalId: ctx.auth.id,
          parentId: ctx.zone1.id,
          sourceIds: [ctx.a1.id],
        },
      ],
    );

    expect(ctx.components()["ref-z1"]).toBeUndefined();
    expect(ctx.targetOf(ctx.e.a1.id)).toBe(ctx.auth.id);
  });
});
