import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Node, NodeChange } from "@xyflow/react";
import { useLocalNodes, dragSelectionRef } from "./useLocalNodes";

/**
 * A Shift/Cmd click is written to the selection store by the pointer funnel on
 * pointerdown. React Flow then runs its own click selection for the same press
 * from the `selected` flags it holds, which may or may not include the
 * funnel's write yet. Applied, it toggled the clicked node back out (or
 * replaced the selection with it): on a busy main thread most shift-clicks
 * were lost. While the funnel owns the press, React Flow's `select` changes
 * are not applied and never reach the store.
 */
function nodes(): Node[] {
  return [
    { id: "a", position: { x: 0, y: 0 }, data: {}, type: "c4", selected: true },
    { id: "b", position: { x: 10, y: 0 }, data: {}, type: "c4", selected: true },
  ];
}

const unselect = (id: string): NodeChange => ({ type: "select", id, selected: false });

function mount() {
  const localNodesRef: MutableRefObject<Node[]> = { current: [] };
  const inner = vi.fn();
  const onSelectionFromChanges = vi.fn();
  const storeNodes = nodes();
  const hook = renderHook(() =>
    useLocalNodes(storeNodes, inner, localNodesRef, onSelectionFromChanges, null),
  );
  return { hook, inner, onSelectionFromChanges, storeNodes };
}

describe("useLocalNodes while the pointer funnel owns the press", () => {
  afterEach(() => {
    dragSelectionRef.selectionWrittenByFunnel = false;
  });

  it("drops React Flow's select changes and reports no selection", () => {
    const { hook, inner, onSelectionFromChanges } = mount();
    dragSelectionRef.selectionWrittenByFunnel = true;

    act(() => hook.result.current.onNodesChange([unselect("b")]));

    expect(inner).not.toHaveBeenCalled();
    expect(onSelectionFromChanges).not.toHaveBeenCalled();
    expect(hook.result.current.nodes.find((n) => n.id === "b")?.selected).toBe(true);
  });

  it("hands React Flow a new object for the node it unselected, so it re-adopts `selected`", () => {
    const { hook, storeNodes } = mount();
    dragSelectionRef.selectionWrittenByFunnel = true;

    act(() => hook.result.current.onNodesChange([unselect("b")]));

    const [a, b] = hook.result.current.nodes;
    expect(a).toBe(storeNodes[0]);
    expect(b).not.toBe(storeNodes[1]);
    expect(b).toEqual(storeNodes[1]);
  });

  it("keeps the changes that are not selection", () => {
    const { hook, inner } = mount();
    dragSelectionRef.selectionWrittenByFunnel = true;
    const move: NodeChange = { type: "position", id: "a", position: { x: 5, y: 5 } };

    act(() => hook.result.current.onNodesChange([unselect("b"), move]));

    expect(inner).toHaveBeenCalledWith([move]);
  });

  it("applies select changes as before once the press is over", () => {
    const { hook, onSelectionFromChanges } = mount();

    act(() => hook.result.current.onNodesChange([unselect("b")]));

    expect(onSelectionFromChanges).toHaveBeenCalledWith(["a"]);
  });
});
