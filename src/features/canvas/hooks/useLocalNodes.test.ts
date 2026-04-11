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
