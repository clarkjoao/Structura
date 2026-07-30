import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasSelectionStore } from "./useCanvasSelectionStore";

/**
 * These lock the invariant documented in the store: `selectedNodeId` is either null or a member of
 * `selectedNodeIds`. Breaking it renders a canvas where the element panel describes one node while
 * a different one keeps the selection ring and stays undimmed.
 */
function read() {
  const { selectedNodeId, selectedNodeIds } = useCanvasSelectionStore.getState();
  return { selectedNodeId, selectedNodeIds: [...selectedNodeIds] };
}

describe("useCanvasSelectionStore", () => {
  beforeEach(() => {
    useCanvasSelectionStore.getState().clearSelection();
  });

  it("moves the whole selection when the primary is promoted from outside it", () => {
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
    // e.g. right-clicking another node, which React Flow does not select on its own
    useCanvasSelectionStore.getState().setSelectedNodeId("b");

    expect(read()).toEqual({ selectedNodeId: "b", selectedNodeIds: ["b"] });
  });

  it("keeps a multi-selection when the promoted primary is already part of it", () => {
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a", "b"]));
    useCanvasSelectionStore.getState().setSelectedNodeId("b");

    expect(read()).toEqual({ selectedNodeId: "b", selectedNodeIds: ["a", "b"] });
  });

  it("demotes the primary when the selection no longer contains it", () => {
    useCanvasSelectionStore.getState().setSelectedNodeId("a");
    // e.g. paste/duplicate, which only writes the set
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["x", "y"]));

    expect(read()).toEqual({ selectedNodeId: "x", selectedNodeIds: ["x", "y"] });
  });

  it("keeps the primary when it survives a selection change", () => {
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a", "b"]));
    useCanvasSelectionStore.getState().setSelectedNodeId("b");
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["b", "c"]));

    expect(read()).toEqual({ selectedNodeId: "b", selectedNodeIds: ["b", "c"] });
  });

  it("clears the primary when the selection becomes empty", () => {
    useCanvasSelectionStore.getState().setSelectedNodeId("a");
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set());

    expect(read()).toEqual({ selectedNodeId: null, selectedNodeIds: [] });
  });

  it("supports the functional updater used by the React Flow selection path", () => {
    useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"]));
    const before = useCanvasSelectionStore.getState().selectedNodeIds;
    // returning `prev` must not churn the reference — an identity-only write re-renders the canvas
    useCanvasSelectionStore.getState().setSelectedNodeIds((prev) => prev);

    expect(useCanvasSelectionStore.getState().selectedNodeIds).toBe(before);
    expect(read()).toEqual({ selectedNodeId: "a", selectedNodeIds: ["a"] });
  });
});
