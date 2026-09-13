import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Node, NodeChange } from "@xyflow/react";
import { useLocalNodes, dragSelectionRef } from "./useLocalNodes";

/**
 * Draw.io parity (decision #3): dragging a node that is NOT selected while other
 * nodes are selected has to remember the prior selection, so `onSelectionChange`
 * can merge them and the whole set moves together.
 *
 * The capture used to sit behind an O(N) scan of the local node list that ran on
 * every frame of every drag. Reordering the guards so the two ref checks come
 * first makes the scan happen at most once per gesture — this freezes the
 * behaviour that reordering must not change.
 */
function nodes(): Node[] {
  return [
    { id: "selected-1", position: { x: 0, y: 0 }, data: {}, type: "c4", selected: true },
    { id: "selected-2", position: { x: 10, y: 0 }, data: {}, type: "c4", selected: true },
    { id: "unselected", position: { x: 20, y: 0 }, data: {}, type: "c4", selected: false },
  ];
}

const frame = (id: string, x: number): NodeChange =>
  ({ type: "position", id, position: { x, y: 0 }, dragging: true }) as NodeChange;

describe("useLocalNodes drag-selection capture", () => {
  beforeEach(() => {
    dragSelectionRef.selectedBeforeDrag = new Set();
    dragSelectionRef.isDragging = false;
  });

  it("captures the prior selection on the first frame of dragging an unselected node", () => {
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const { result } = renderHook(() =>
      useLocalNodes(nodes(), vi.fn(), localNodesRef, vi.fn(), null),
    );

    act(() => {
      result.current.onNodesChange([frame("unselected", 30)]);
    });

    expect(dragSelectionRef.isDragging).toBe(true);
    expect([...dragSelectionRef.selectedBeforeDrag].sort()).toEqual(["selected-1", "selected-2"]);
  });

  it("does not re-capture on later frames of the same gesture", () => {
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const { result } = renderHook(() =>
      useLocalNodes(nodes(), vi.fn(), localNodesRef, vi.fn(), null),
    );

    act(() => {
      result.current.onNodesChange([frame("unselected", 30)]);
    });
    const captured = [...dragSelectionRef.selectedBeforeDrag].sort();

    // a later frame must leave the captured set exactly as it was
    act(() => {
      for (let i = 2; i <= 10; i++)
        result.current.onNodesChange([frame("unselected", 30 + i * 15)]);
    });

    expect([...dragSelectionRef.selectedBeforeDrag].sort()).toEqual(captured);
    expect(dragSelectionRef.isDragging).toBe(true);
  });

  it("captures nothing when the dragged node is already selected", () => {
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const { result } = renderHook(() =>
      useLocalNodes(nodes(), vi.fn(), localNodesRef, vi.fn(), null),
    );

    act(() => {
      result.current.onNodesChange([frame("selected-1", 30)]);
    });

    expect(dragSelectionRef.isDragging).toBe(false);
    expect(dragSelectionRef.selectedBeforeDrag.size).toBe(0);
  });

  it("captures nothing when there was no prior selection", () => {
    const localNodesRef: MutableRefObject<Node[]> = { current: [] };
    const none = nodes().map((n) => ({ ...n, selected: false }));
    const { result } = renderHook(() => useLocalNodes(none, vi.fn(), localNodesRef, vi.fn(), null));

    act(() => {
      result.current.onNodesChange([frame("unselected", 30)]);
    });

    expect(dragSelectionRef.isDragging).toBe(false);
    expect(dragSelectionRef.selectedBeforeDrag.size).toBe(0);
  });
});
