import { describe, expect, it } from "vitest";
import { applyEffectivePatch, type DiagramState } from "@collab-protocol";
import { makeState } from "../../../../server/src/collab/store/__fixtures__/merge.fixtures";
import {
  applyEntry,
  captureLocal,
  diffStates,
  initialSync,
  isSettled,
  markSent,
  refuseOp,
  visibleState,
} from "../sync/rebase";

const base = (): DiagramState =>
  makeState(
    {
      components: {
        c1: { id: "c1", name: "API", description: "edge" },
        c2: { id: "c2", name: "DB" },
      },
      nodeLayouts: { c1: { elementId: "c1", x: 0, y: 0 }, c2: { elementId: "c2", x: 100, y: 0 } },
    },
    { diagramId: "d", diagramName: "D", level: "context" },
  );

/** What the editor would hold after a local edit. */
function edit(state: DiagramState, fn: (draft: DiagramState) => void): DiagramState {
  const draft = structuredClone(state);
  fn(draft);
  // Keep untouched collections' identity, as the immutable store does.
  for (const key of Object.keys(draft.entities) as Array<keyof DiagramState["entities"]>) {
    if (JSON.stringify(draft.entities[key]) === JSON.stringify(state.entities[key])) {
      draft.entities[key] = state.entities[key];
    }
  }
  return draft;
}

describe("diffStates", () => {
  it("reports only the fields that changed", () => {
    const a = base();
    const b = edit(a, (d) => {
      d.entities.nodeLayouts.c1.x = 50;
    });
    expect(diffStates(a, b)).toEqual({ entities: { nodeLayouts: { c1: { set: { x: 50 } } } } });
  });

  it("reports creations whole, removals as null, and removed fields as unset", () => {
    const a = base();
    const b = edit(a, (d) => {
      d.entities.components.c3 = { id: "c3", name: "Cache" };
      delete d.entities.components.c2;
      delete d.entities.components.c1.description;
    });
    expect(diffStates(a, b)).toEqual({
      entities: {
        components: {
          c1: { unset: ["description"] },
          c2: null,
          c3: { set: { id: "c3", name: "Cache" } },
        },
      },
    });
  });

  it("treats undefined fields as absent and ignores value-equal copies", () => {
    const a = base();
    const b = edit(a, (d) => {
      d.entities.components.c1 = { ...d.entities.components.c1, extra: undefined };
    });
    expect(diffStates(a, b)).toBeNull();
  });

  it("diffs doc fields, with absent and null alike", () => {
    const a = base();
    const b = edit(a, (d) => {
      d.doc.diagramName = "E";
      d.doc.domain = null;
    });
    expect(diffStates(a, b)).toEqual({ doc: { diagramName: "E" } });
  });

  it("never reports the diagram id", () => {
    const a = base();
    const b = edit(a, (d) => {
      d.doc.diagramId = "other";
    });
    expect(diffStates(a, b)).toBeNull();
  });
});

describe("optimistic rebase", () => {
  it("keeps a local edit in view while a peer's entry is applied underneath", () => {
    let sync = initialSync(base(), 0);
    const local = edit(base(), (d) => {
      d.entities.nodeLayouts.c1.x = 500;
    });
    sync = captureLocal(sync, local);
    sync = markSent(sync, "mine").sync;
    // A peer moves c2 meanwhile.
    sync = applyEntry(sync, {
      version: 1,
      opId: "theirs",
      patch: { entities: { nodeLayouts: { c2: { set: { x: 900 } } } } },
    });
    const view = visibleState(sync);
    expect(view.entities.nodeLayouts.c1.x).toBe(500);
    expect(view.entities.nodeLayouts.c2.x).toBe(900);
    expect(isSettled(sync)).toBe(false);
  });

  it("a concurrent drag of the same node: my pending position wins in view until confirmed", () => {
    let sync = initialSync(base(), 0);
    sync = captureLocal(
      sync,
      edit(base(), (d) => void (d.entities.nodeLayouts.c1.x = 500)),
    );
    sync = markSent(sync, "mine").sync;
    sync = applyEntry(sync, {
      version: 1,
      opId: "theirs",
      patch: { entities: { nodeLayouts: { c1: { set: { x: 300 } } } } },
    });
    expect(visibleState(sync).entities.nodeLayouts.c1.x).toBe(500);
    // Mine is ordered after theirs: confirmed agrees, and nothing is pending.
    sync = applyEntry(sync, {
      version: 2,
      opId: "mine",
      patch: { entities: { nodeLayouts: { c1: { set: { x: 500 } } } } },
    });
    expect(sync.confirmed.entities.nodeLayouts.c1.x).toBe(500);
    expect(isSettled(sync)).toBe(true);
  });

  it("a peer's delete under my pending edit: the entity is gone once my op is refused", () => {
    let sync = initialSync(base(), 0);
    sync = captureLocal(
      sync,
      edit(base(), (d) => void (d.entities.nodeLayouts.c2.x = 7)),
    );
    sync = markSent(sync, "mine").sync;
    sync = applyEntry(sync, {
      version: 1,
      opId: "theirs",
      patch: { entities: { nodeLayouts: { c2: null }, components: { c2: null } } },
    });
    // The relay drops my stale write (remove wins) and acknowledges it as not applied.
    sync = refuseOp(sync, "mine");
    const view = visibleState(sync);
    expect(view.entities.nodeLayouts.c2).toBeUndefined();
    expect(view.entities.components.c2).toBeUndefined();
  });

  it("a refused op (lock denied) reverts in view", () => {
    let sync = initialSync(base(), 0);
    sync = captureLocal(
      sync,
      edit(base(), (d) => void (d.entities.nodeLayouts.c1.x = 42)),
    );
    sync = markSent(sync, "mine").sync;
    expect(visibleState(sync).entities.nodeLayouts.c1.x).toBe(42);
    sync = refuseOp(sync, "mine");
    expect(visibleState(sync).entities.nodeLayouts.c1.x).toBe(0);
  });

  it("my own entry with only part applied leaves exactly that part", () => {
    let sync = initialSync(base(), 0);
    sync = captureLocal(
      sync,
      edit(base(), (d) => {
        d.entities.nodeLayouts.c1.x = 9;
        d.entities.components.c1.description = "public";
      }),
    );
    sync = markSent(sync, "mine").sync;
    sync = applyEntry(sync, {
      version: 1,
      opId: "mine",
      patch: { entities: { components: { c1: { set: { description: "public" } } } } },
    });
    const view = visibleState(sync);
    expect(view.entities.components.c1.description).toBe("public");
    expect(view.entities.nodeLayouts.c1.x).toBe(0);
  });

  it("unsent changes coalesce into one patch", () => {
    let sync = initialSync(base(), 0);
    let editor = edit(base(), (d) => void (d.entities.nodeLayouts.c1.x = 1));
    sync = captureLocal(sync, editor);
    editor = edit(editor, (d) => void (d.entities.nodeLayouts.c1.x = 2));
    sync = captureLocal(sync, editor);
    editor = edit(editor, (d) => void (d.entities.nodeLayouts.c1.y = 3));
    sync = captureLocal(sync, editor);
    expect(sync.unsent).toEqual({ entities: { nodeLayouts: { c1: { set: { x: 2, y: 3 } } } } });
  });

  it("ignores entries at or below the current version", () => {
    const sync = initialSync(base(), 5);
    expect(
      applyEntry(sync, { version: 5, opId: "x", patch: { doc: { diagramName: "late" } } }),
    ).toBe(sync);
  });

  it("an editor matching confirmed state has nothing to send", () => {
    const sync = captureLocal(initialSync(base(), 0), base());
    expect(sync.unsent).toBeNull();
    expect(isSettled(sync)).toBe(true);
  });

  it("visible equals confirmed plus every local patch, in order", () => {
    let sync = initialSync(base(), 0);
    const e1 = edit(base(), (d) => void (d.entities.nodeLayouts.c1.x = 1));
    sync = markSent(captureLocal(sync, e1), "a").sync;
    const e2 = edit(e1, (d) => void (d.entities.nodeLayouts.c1.x = 2));
    sync = captureLocal(sync, e2);
    expect(visibleState(sync)).toEqual(
      applyEffectivePatch(applyEffectivePatch(base(), sync.sent[0].patch), sync.unsent ?? {}),
    );
    expect(visibleState(sync).entities.nodeLayouts.c1.x).toBe(2);
  });
});
