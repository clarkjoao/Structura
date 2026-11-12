import { describe, expect, it } from "vitest";
import { orNone, stableFlowRefs, stableNames, unmountedRendererCallback } from "./stableNodeLists";

describe("stable node lists", () => {
  it("keeps the previous list of an owner while its content is equal", () => {
    const owner = {};
    const first = stableFlowRefs(owner, [{ id: "f1", name: "A" }]);
    expect(stableFlowRefs(owner, [{ id: "f1", name: "A" }])).toBe(first);
    expect(stableFlowRefs(owner, [{ id: "f1", name: "B" }])).not.toBe(first);
  });

  it("does not share a list between owners", () => {
    const a = stableNames({}, ["x"]);
    const b = stableNames({}, ["x"]);
    expect(a).not.toBe(b);
    expect(b).toEqual(["x"]);
  });

  it("hands every empty list as the same one", () => {
    expect(stableNames({}, [])).toBe(stableFlowRefs({}, []));
    expect(orNone(undefined)).toBe(orNone([]));
    expect(orNone(["a"])).toEqual(["a"]);
  });
});

describe("a renderer callback slot on the data", () => {
  it("is built on the note and the JSON viewer, so the kept data stays the same length", async () => {
    const { noteElement } = await import("./note.element");
    const { jsonViewerElement } = await import("./json-viewer.element");
    const ctx = {
      selectedNodeId: null,
      resolvedNodeLayouts: {},
      versionBadgeByComponentId: {},
    } as unknown as Parameters<typeof noteElement.canvas.buildData>[1];
    const note = noteElement.canvas.buildData(
      { id: "n1", type: "note", name: "n", description: "" } as never,
      ctx,
    );
    const viewer = jsonViewerElement.canvas.buildData(
      { id: "j1", type: "json-viewer", name: "j", description: "", jsonContent: "{}" } as never,
      ctx,
    );
    expect(note.onStartEdit).toBe(unmountedRendererCallback);
    expect(note.onClickBody).toBe(unmountedRendererCallback);
    expect(viewer.onStartEdit).toBe(unmountedRendererCallback);
  });
});
