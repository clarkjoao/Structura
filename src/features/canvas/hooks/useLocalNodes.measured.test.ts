/**
 * `measured` must survive every store write React Flow sees.
 *
 * React Flow rebuilds a node's internals whenever the user node object changes
 * identity, and `parseHandles` in `@xyflow/system` drops `handleBounds`
 * whenever the incoming node has no `measured` (Structura nodes carry no
 * `handles` either, so there is nothing to rebuild the bounds from). With no
 * `handleBounds`, `getEdgePosition` returns `null` for every edge touching the
 * node, `EdgeWrapper` renders `null`, and the whole edge layer unmounts until
 * the ResizeObserver measures again — 439 `<svg>` removed and re-appended on a
 * 400-node diagram, for a drag that moved one node.
 *
 * The store-derived array never carries `measured`: only React Flow knows it,
 * and it reaches the local copy through `dimensions` changes. So the rule this
 * file locks is: whatever `useLocalNodes` hands back, a node that had
 * `measured` still has it.
 *
 * See `docs/investigation/edge-relayer.md`.
 */

import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useLocalNodes } from "./useLocalNodes";

const MEASURED = { width: 100, height: 40 };

function makeDiagram(nodeLayouts: Diagram["nodeLayouts"]): Diagram {
  return {
    id: "d1",
    name: "test",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts,
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

/** A fresh layout record — a store write always gives `nodeLayouts` a new identity. */
function layoutsAt(x: number): Diagram["nodeLayouts"] {
  return {
    a: { elementId: "a", x, y: 0 },
    b: { elementId: "b", x: 50, y: 50 },
  };
}

function storeNodesAt(x: number, parentIdOfA: string | undefined = undefined): Node[] {
  return [
    { id: "a", position: { x, y: 0 }, data: {}, type: "c4", parentId: parentIdOfA },
    { id: "b", position: { x: 50, y: 50 }, data: {}, type: "c4" },
  ];
}

interface HookProps {
  nodes: Node[];
  diagram: Diagram;
}

function mount(initial: HookProps) {
  const localNodesRef: MutableRefObject<Node[]> = { current: [] };
  const view = renderHook(
    ({ nodes, diagram }: HookProps) =>
      useLocalNodes(nodes, vi.fn(), localNodesRef, undefined, diagram),
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

describe("useLocalNodes — measured dimensions", () => {
  beforeEach(() => {
    useDiagramStore.setState({ _lastUndoRedoAt: 0 });
  });

  it("keeps measured across a drag commit", () => {
    const { result, rerender } = mount({
      nodes: storeNodesAt(0),
      diagram: makeDiagram(layoutsAt(0)),
    });
    measureAll(result.current.onNodesChange);
    expect(result.current.nodes.map((n) => n.measured)).toEqual([MEASURED, MEASURED]);

    // A drag commit: `batchCommitNodeDrag` writes through Immer, so `nodeLayouts`
    // gets a new identity and the derived node array is rebuilt without `measured`.
    rerender({ nodes: storeNodesAt(120), diagram: makeDiagram(layoutsAt(120)) });

    expect(result.current.nodes.map((n) => n.measured)).toEqual([MEASURED, MEASURED]);
  });

  it("replaces local positions on a real undo, but still keeps measured", () => {
    const { result, rerender } = mount({
      nodes: storeNodesAt(0),
      diagram: makeDiagram(layoutsAt(0)),
    });
    measureAll(result.current.onNodesChange);

    // The user drags `a` locally; React Flow reports the position, the store has not caught up.
    act(() => {
      result.current.onNodesChange([
        { id: "a", type: "position", position: { x: 999, y: 0 }, dragging: false },
      ]);
    });
    expect(result.current.nodes[0].position.x).toBe(999);

    // A real undo: the history slice stamps `_lastUndoRedoAt` and swaps `nodeLayouts`.
    act(() => {
      useDiagramStore.setState({ _lastUndoRedoAt: Date.now() });
    });
    rerender({ nodes: storeNodesAt(0), diagram: makeDiagram(layoutsAt(0)) });

    // The stale local position is discarded — that is what the branch exists for.
    expect(result.current.nodes[0].position.x).toBe(0);
    // `measured` is not stale state, and must not be discarded with it.
    expect(result.current.nodes.map((n) => n.measured)).toEqual([MEASURED, MEASURED]);
  });

  it("never hands React Flow a node that lost measured, on any store write", () => {
    const { result, rerender } = mount({
      nodes: storeNodesAt(0),
      diagram: makeDiagram(layoutsAt(0)),
    });
    measureAll(result.current.onNodesChange);

    const writes: Array<{ what: string; props: HookProps }> = [
      // Plain move.
      {
        what: "drag commit",
        props: { nodes: storeNodesAt(120), diagram: makeDiagram(layoutsAt(120)) },
      },
      // Move plus re-parent — takes the remote position, still must keep measured.
      {
        what: "re-parent commit",
        props: { nodes: storeNodesAt(240, "b"), diagram: makeDiagram(layoutsAt(240)) },
      },
      // A node appears: the length-mismatch branch.
      {
        what: "node added",
        props: {
          nodes: [
            ...storeNodesAt(240, "b"),
            { id: "c", position: { x: 10, y: 10 }, data: {}, type: "c4" },
          ],
          diagram: makeDiagram({ ...layoutsAt(240), c: { elementId: "c", x: 10, y: 10 } }),
        },
      },
    ];

    for (const { what, props } of writes) {
      rerender(props);
      const lost = result.current.nodes
        .filter((n) => n.id === "a" || n.id === "b")
        .filter((n) => n.measured?.width === undefined)
        .map((n) => n.id);
      expect(lost, `${what} dropped measured on: ${lost.join(", ")}`).toEqual([]);
    }
  });
});
