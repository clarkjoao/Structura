/**
 * Versions as branches: copy-on-write of base elements, conflicts when the base moves on, merge
 * with replaced elements, and writing a whole Version by key (what the plugin API does).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";
import { HISTORY_COALESCE_MS } from "../store.constants";
import { resolveVersionSnapshot, versionConflicts } from "../../utils/version.utils";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
const settle = () => vi.advanceTimersByTime(HISTORY_COALESCE_MS + 100);

function setup() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Branches", "container");
  store.getState().openDiagram(diagram.id);
  const d = () => store.getState().diagrams[diagram.id]!;
  const api = store.getState().addComponent("system", "API", null, { x: 0, y: 0 });
  const db = store.getState().addComponent("system", "DB", null, { x: 300, y: 0 });
  const conn = store.getState().addConnection(api.id, db.id, "writes")!;
  settle();
  const openVersion = () => {
    const v = store.getState().addVersion("Plan");
    store.getState().setActiveVersion(v.id);
    settle();
    return v;
  };
  return { store, diagramId: diagram.id, d, api, db, conn, openVersion };
}

describe("copy-on-write", () => {
  it("edits a copy of a base component and leaves the base alone", () => {
    const ctx = setup();
    const v = ctx.openVersion();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API v2" });
    expect(ctx.d().snapshot.components[ctx.api.id]!.name).toBe("API");
    const version = ctx.d().versions![v.id]!;
    expect(version.modifiedComponents![ctx.api.id]!.name).toBe("API v2");
    expect(version.baseHashes![ctx.api.id]).toMatch(/^[0-9a-f]{14}$/);
    expect(resolveVersionSnapshot(ctx.d(), v.id).components[ctx.api.id]!.name).toBe("API v2");
  });

  it("undo drops the copy", () => {
    const ctx = setup();
    const v = ctx.openVersion();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API v2" });
    settle();
    ctx.store.getState().undo();
    expect(ctx.d().versions![v.id]!.modifiedComponents?.[ctx.api.id]).toBeUndefined();
  });

  it("keeps the first base hash across later edits of the copy", () => {
    const ctx = setup();
    const v = ctx.openVersion();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API v2" });
    const first = ctx.d().versions![v.id]!.baseHashes![ctx.api.id];
    ctx.store.getState().updateComponent(ctx.api.id, { description: "now with events" });
    expect(ctx.d().versions![v.id]!.baseHashes![ctx.api.id]).toBe(first);
    expect(ctx.d().versions![v.id]!.modifiedComponents![ctx.api.id]).toMatchObject({
      name: "API v2",
      description: "now with events",
    });
  });

  it("copies a base connection on edit", () => {
    const ctx = setup();
    const v = ctx.openVersion();
    ctx.store.getState().updateConnection(ctx.conn.id, { label: "publishes" });
    expect(ctx.d().snapshot.connections[ctx.conn.id]!.label).toBe("writes");
    expect(ctx.d().versions![v.id]!.modifiedConnections![ctx.conn.id]!.label).toBe("publishes");
  });

  it("forgets the copy when the element is removed in the Version", () => {
    const ctx = setup();
    const v = ctx.openVersion();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API v2" });
    ctx.store.getState().removeComponent(ctx.api.id);
    const version = ctx.d().versions![v.id]!;
    expect(version.removedComponentIds).toContain(ctx.api.id);
    expect(version.modifiedComponents?.[ctx.api.id]).toBeUndefined();
  });

  it("writes to the base when no Version is active", () => {
    const ctx = setup();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API v2" });
    expect(ctx.d().snapshot.components[ctx.api.id]!.name).toBe("API v2");
  });
});

describe("conflicts", () => {
  function conflicted() {
    const ctx = setup();
    const v = ctx.openVersion();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API v2" });
    ctx.store.getState().setActiveVersion(null);
    ctx.store.getState().updateComponent(ctx.api.id, { description: "changed in production" });
    ctx.store.getState().setActiveVersion(v.id);
    settle();
    return { ...ctx, v };
  }

  it("reports a base changed after the copy", () => {
    const ctx = conflicted();
    expect(versionConflicts(ctx.d(), ctx.v.id)).toEqual([
      { id: ctx.api.id, kind: "component", reason: "base-changed" },
    ]);
  });

  it("refuses the merge until resolved; keep rebases the copy", () => {
    const ctx = conflicted();
    expect(ctx.store.getState().mergeVersionIntoBase(ctx.v.id)).toBe(false);
    expect(ctx.d().versions![ctx.v.id]).toBeDefined();
    ctx.store.getState().keepVersionCopy(ctx.v.id, ctx.api.id);
    expect(versionConflicts(ctx.d(), ctx.v.id)).toEqual([]);
    expect(ctx.store.getState().mergeVersionIntoBase(ctx.v.id)).toBe(true);
    expect(ctx.d().snapshot.components[ctx.api.id]!.name).toBe("API v2");
  });

  it("use base drops the copy", () => {
    const ctx = conflicted();
    ctx.store.getState().takeBaseVersion(ctx.v.id, ctx.api.id);
    expect(versionConflicts(ctx.d(), ctx.v.id)).toEqual([]);
    expect(resolveVersionSnapshot(ctx.d(), ctx.v.id).components[ctx.api.id]!.description).toBe(
      "changed in production",
    );
  });
});

describe("merge", () => {
  it("writes added and replaced elements and layout overrides into the base", () => {
    const ctx = setup();
    const v = ctx.openVersion();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API v2" });
    ctx.store.getState().updateNodeLayout(ctx.db.id, { x: 500, y: 40 });
    const cache = ctx.store.getState().addComponent("system", "Cache", null, { x: 0, y: 200 });
    expect(ctx.store.getState().mergeVersionIntoBase(v.id)).toBe(true);
    const d = ctx.d();
    expect(d.versions?.[v.id]).toBeUndefined();
    expect(d.snapshot.components[ctx.api.id]!.name).toBe("API v2");
    expect(d.snapshot.components[cache.id]).toBeDefined();
    expect(d.nodeLayouts[ctx.db.id]).toMatchObject({ x: 500, y: 40 });
  });

  it("leaves another Version's copy of a merged element in conflict", () => {
    const ctx = setup();
    const a = ctx.openVersion();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API from A" });
    const b = ctx.openVersion();
    ctx.store.getState().updateComponent(ctx.api.id, { name: "API from B" });
    ctx.store.getState().setActiveVersion(a.id);
    expect(ctx.store.getState().mergeVersionIntoBase(a.id)).toBe(true);
    expect(versionConflicts(ctx.d(), b.id).map((c) => c.id)).toEqual([ctx.api.id]);
  });
});

describe("a whole Version by key", () => {
  it("creates, then replaces the content of the Version with that key, copying what it modifies", () => {
    const ctx = setup();
    const target = {
      key: "remote-sessions",
      name: "Remote sessions",
      status: "in-progress" as const,
      ownerPluginId: "opscr",
      reset: true,
    };
    const first = ctx.store
      .getState()
      .applyGraphChanges({ update: [{ id: ctx.api.id, name: "API v2" }] }, ctx.diagramId, target);
    const second = ctx.store.getState().applyGraphChanges(
      {
        remove: [ctx.db.id],
        add: [
          {
            externalId: "store",
            type: "system",
            name: "Store",
            parentExternalId: null,
            x: 0,
            y: 300,
          },
        ],
      },
      ctx.diagramId,
      target,
    );
    expect(second.versionId).toBe(first.versionId);
    const versions = Object.values(ctx.d().versions!);
    expect(versions).toHaveLength(1);
    const v = versions[0]!;
    expect(v).toMatchObject({
      key: "remote-sessions",
      status: "in-progress",
      ownerPluginId: "opscr",
    });
    expect(v.modifiedComponents?.[ctx.api.id]).toBeUndefined();
    expect(v.removedComponentIds).toContain(ctx.db.id);
    expect(Object.values(v.addedComponents).map((c) => c.name)).toEqual(["Store"]);
    expect(ctx.d().snapshot.components[ctx.db.id]).toBeDefined();
    expect(ctx.d().activeVersionId ?? null).toBeNull();
  });
});

describe("linked diagrams", () => {
  it("open with the Version that has the same key, or their base", () => {
    const ctx = setup();
    const other = ctx.store.getState().addDiagram("C2", "container");
    const target = { key: "remote-sessions", name: "Remote sessions", reset: true };
    const here = ctx.store.getState().applyGraphChanges({}, ctx.diagramId, target);
    const there = ctx.store.getState().applyGraphChanges({}, other.id, target);
    ctx.store.getState().setActiveVersionByKey(ctx.diagramId, "remote-sessions");
    ctx.store.getState().carryActiveVersionKey(ctx.diagramId, other.id);
    expect(ctx.store.getState().diagrams[ctx.diagramId]!.activeVersionId).toBe(here.versionId);
    expect(ctx.store.getState().diagrams[other.id]!.activeVersionId).toBe(there.versionId);

    const third = ctx.store.getState().addDiagram("Deployment", "deployment");
    ctx.store.getState().carryActiveVersionKey(ctx.diagramId, third.id);
    expect(ctx.store.getState().diagrams[third.id]!.activeVersionId ?? null).toBeNull();
  });
});

describe("stored Versions from before", () => {
  it("resolve as they did: added and removed only, no new fields written", () => {
    const ctx = setup();
    const v = ctx.openVersion();
    ctx.store.getState().removeComponent(ctx.db.id);
    const version = ctx.d().versions![v.id]!;
    expect(version.modifiedComponents).toBeUndefined();
    expect(version.baseHashes).toBeUndefined();
    expect(Object.keys(resolveVersionSnapshot(ctx.d(), v.id).components)).toEqual([ctx.api.id]);
  });
});
