import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { useLocalNodes } from "./useLocalNodes";

/**
 * A layout the store computed has to reach the canvas.
 *
 * The local node copy holds the position React Flow painted, and it wins over
 * the store's — that is the whole point during a drag, where the store is a
 * frame behind the pointer. But it also won over a position the store wrote on
 * purpose, and `applyAutoLayout` writes exactly that. So auto layout moved
 * every node in the store and the canvas kept the old picture; the new one
 * only appeared on a page reload, which re-seeds the local copy from scratch.
 *
 * Reproduced in the browser before this test existed: on a seed diagram, one
 * Auto Layout (LR) moved 11 of 11 nodes in `nodeLayouts` and 0 of 11 in the
 * DOM. Same on the previous commit, so this is not a regression — it is a bug
 * that was always there and that the reading route made obvious.
 *
 * The signal is a counter the store bumps when it repositions nodes itself,
 * the same shape as `_lastUndoRedoAt`. Undo already worked for this reason.
 */

const MEASURED = { width: 100, height: 40 };

function makeDiagram(): Diagram {
  return {
    id: "d1",
    name: "test",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function storeNodesAt(ax: number, ay: number): Node[] {
  return [
    { id: "a", position: { x: ax, y: ay }, data: {}, type: "c4" },
    { id: "b", position: { x: 50, y: 50 }, data: {}, type: "c4" },
  ];
}

interface HookProps {
  nodes: Node[];
  lastUndoRedoAt?: number;
  lastLayoutWriteAt?: number;
}

function mount(initial: HookProps) {
  const localNodesRef: MutableRefObject<Node[]> = { current: [] };
  const diagram = makeDiagram();
  const view = renderHook(
    ({ nodes, lastUndoRedoAt, lastLayoutWriteAt }: HookProps) =>
      useLocalNodes(
        nodes,
        vi.fn(),
        localNodesRef,
        undefined,
        diagram,
        undefined,
        lastUndoRedoAt,
        lastLayoutWriteAt,
      ),
    { initialProps: initial },
  );
  return { ...view, localNodesRef };
}

/** What React Flow's ResizeObserver does on the first paint. */
function measureAll(onNodesChange: ReturnType<typeof useLocalNodes>["onNodesChange"]) {
  act(() => {
    onNodesChange([
      { id: "a", type: "dimensions", dimensions: MEASURED },
      { id: "b", type: "dimensions", dimensions: MEASURED },
    ]);
  });
}

describe("a layout the store wrote", () => {
  it("reaches the canvas", () => {
    const { result, rerender, localNodesRef } = mount({
      nodes: storeNodesAt(0, 0),
      lastUndoRedoAt: 0,
      lastLayoutWriteAt: 0,
    });
    measureAll(result.current.onNodesChange);

    // `applyAutoLayout`: new positions, new `nodeLayouts` identity, and the
    // stamp bumped. Nothing about the parenting changed.
    rerender({ nodes: storeNodesAt(640, 480), lastUndoRedoAt: 0, lastLayoutWriteAt: 1 });

    const a = localNodesRef.current.find((n) => n.id === "a")!;
    expect(a.position).toEqual({ x: 640, y: 480 });
  });

  it("keeps what React Flow measured, so the edge layer does not unmount", () => {
    const { result, rerender, localNodesRef } = mount({
      nodes: storeNodesAt(0, 0),
      lastUndoRedoAt: 0,
      lastLayoutWriteAt: 0,
    });
    measureAll(result.current.onNodesChange);

    rerender({ nodes: storeNodesAt(640, 480), lastUndoRedoAt: 0, lastLayoutWriteAt: 1 });

    for (const node of localNodesRef.current) {
      expect(node.measured, `${node.id} lost its measured size`).toEqual(MEASURED);
    }
  });

  /**
   * The guard that keeps this from becoming "always take the store's
   * position": a drag commit writes the store without bumping the stamp, and
   * there the local copy is still the truth — it is what React Flow painted.
   */
  it("does not fire on a store write that is not a layout", () => {
    const { result, rerender, localNodesRef } = mount({
      nodes: storeNodesAt(0, 0),
      lastUndoRedoAt: 0,
      lastLayoutWriteAt: 0,
    });
    measureAll(result.current.onNodesChange);

    act(() => {
      result.current.onNodesChange([
        { id: "a", type: "position", position: { x: 15, y: 15 }, dragging: false },
      ]);
    });

    rerender({ nodes: storeNodesAt(15, 15), lastUndoRedoAt: 0, lastLayoutWriteAt: 0 });

    const a = localNodesRef.current.find((n) => n.id === "a")!;
    expect(a.position).toEqual({ x: 15, y: 15 });
  });
});
