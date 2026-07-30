import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import { useLocalNodes } from "./useLocalNodes";

function createTestNodes(): Node[] {
  return [
    {
      id: "a",
      position: { x: 0, y: 0 },
      data: {},
      type: "c4",
      selected: false,
    },
    {
      id: "b",
      position: { x: 50, y: 50 },
      data: {},
      type: "c4",
      selected: false,
    },
  ];
}

describe("useLocalNodes", () => {
  it("calls onSelectionFromChanges for a single select change (single-select sync)", () => {
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const innerOnNodesChange = vi.fn();
    const onSelectionFromChanges = vi.fn();
    const initialNodes = createTestNodes();

    const { result } = renderHook(() =>
      useLocalNodes(initialNodes, innerOnNodesChange, localNodesRef, onSelectionFromChanges, null),
    );

    act(() => {
      result.current.onNodesChange([{ type: "select", id: "a", selected: true }]);
    });

    expect(onSelectionFromChanges).toHaveBeenCalledTimes(1);
    expect(onSelectionFromChanges).toHaveBeenCalledWith(["a"]);
  });

  it("calls onSelectionFromChanges when all nodes are deselected", () => {
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const innerOnNodesChange = vi.fn();
    const onSelectionFromChanges = vi.fn();
    const initialNodes = createTestNodes().map((node, index) =>
      index === 0 ? { ...node, selected: true } : node,
    );

    const { result } = renderHook(() =>
      useLocalNodes(initialNodes, innerOnNodesChange, localNodesRef, onSelectionFromChanges, null),
    );

    act(() => {
      result.current.onNodesChange([{ type: "select", id: "a", selected: false }]);
    });

    expect(onSelectionFromChanges).toHaveBeenCalledTimes(1);
    expect(onSelectionFromChanges).toHaveBeenCalledWith([]);
  });

  it("adopts the store selection so a selection made outside React Flow moves the ring", () => {
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const innerOnNodesChange = vi.fn();
    const initialNodes = createTestNodes();

    const { result, rerender } = renderHook(
      ({ storeNodes }: { storeNodes: Node[] }) =>
        useLocalNodes(storeNodes, innerOnNodesChange, localNodesRef, undefined, null),
      { initialProps: { storeNodes: initialNodes } },
    );

    act(() => {
      result.current.onNodesChange([{ type: "select", id: "a", selected: true }]);
    });
    expect(result.current.nodes.find((node) => node.id === "a")?.selected).toBe(true);

    // Same node count, only `selected` differs — e.g. a context-menu/keyboard/search selection
    // that never went through React Flow. Must land in the very render that received the new
    // `storeNodes`, otherwise React Flow paints the previous selection for a frame.
    const storeNodes = createTestNodes().map((node) =>
      node.id === "b" ? { ...node, selected: true } : node,
    );
    rerender({ storeNodes });

    expect(result.current.nodes.find((node) => node.id === "a")?.selected).toBe(false);
    expect(result.current.nodes.find((node) => node.id === "b")?.selected).toBe(true);
  });

  it("does not clobber local state when re-rendered with the same storeNodes", () => {
    // The merge runs during render, so a repeated (or React-double-invoked) render must be a
    // no-op — otherwise local-only state such as an in-flight selection would be wiped.
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const innerOnNodesChange = vi.fn();
    const initialNodes = createTestNodes();

    const { result, rerender } = renderHook(
      ({ storeNodes }: { storeNodes: Node[] }) =>
        useLocalNodes(storeNodes, innerOnNodesChange, localNodesRef, undefined, null),
      { initialProps: { storeNodes: initialNodes } },
    );

    act(() => {
      result.current.onNodesChange([{ type: "select", id: "a", selected: true }]);
    });

    rerender({ storeNodes: initialNodes });
    rerender({ storeNodes: initialNodes });

    expect(result.current.nodes.find((node) => node.id === "a")?.selected).toBe(true);
  });

  it("reports multiple selected ids after additive select changes", () => {
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const innerOnNodesChange = vi.fn();
    const onSelectionFromChanges = vi.fn();
    const initialNodes = createTestNodes();

    const { result } = renderHook(() =>
      useLocalNodes(initialNodes, innerOnNodesChange, localNodesRef, onSelectionFromChanges, null),
    );

    act(() => {
      result.current.onNodesChange([
        { type: "select", id: "a", selected: true },
        { type: "select", id: "b", selected: true },
      ]);
    });

    expect(onSelectionFromChanges).toHaveBeenCalledWith(["a", "b"]);
  });
});
