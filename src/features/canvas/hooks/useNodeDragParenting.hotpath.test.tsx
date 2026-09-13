import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Node, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { useNodeDragParenting } from "./useNodeDragParenting";

/**
 * The contract this freezes: a drag frame must not walk the node list.
 *
 * The parent-candidate lookup is allowed to build an index once, on the first
 * frame of a gesture — panels do not move while a child is dragged. Every
 * frame after that has to be O(1) in the number of nodes, which is what the
 * 5.000-node horizon requires.
 */
const NODE_COUNT = 300;

/** Array whose scanning methods are counted, so the test measures instead of assuming. */
function countingArray<T>(items: T[]): { array: T[]; scans: () => number; reset: () => void } {
  let scans = 0;
  const array = items.slice() as T[];
  for (const method of [
    "find",
    "filter",
    "map",
    "forEach",
    "some",
    "every",
    "reduce",
    "indexOf",
    "findIndex",
  ] as const) {
    const original = Array.prototype[method] as unknown as (...args: unknown[]) => unknown;
    Object.defineProperty(array, method, {
      configurable: true,
      writable: true,
      value: function (this: T[], ...args: unknown[]) {
        scans += 1;
        return original.apply(this, args);
      },
    });
  }
  return {
    array,
    scans: () => scans,
    reset: () => {
      scans = 0;
    },
  };
}

function buildFixture() {
  const nodes: Node[] = [];
  const components: Record<string, unknown> = {};
  const nodeLayouts: Record<string, unknown> = {};

  const panels = [
    { id: "P0", parentId: null, x: 0, y: 0, w: 4000, h: 4000 },
    { id: "P1", parentId: "P0", x: 100, y: 100, w: 2000, h: 2000 },
    { id: "P2", parentId: "P1", x: 100, y: 100, w: 900, h: 900 },
  ];
  for (const p of panels) {
    nodes.push({
      id: p.id,
      type: "panel",
      position: { x: p.x, y: p.y },
      data: {},
      style: { width: p.w, height: p.h },
      ...(p.parentId ? { parentId: p.parentId, extent: "parent" as const } : {}),
    });
    components[p.id] = { id: p.id, name: p.id, type: "panel", parentId: p.parentId };
    nodeLayouts[p.id] = { elementId: p.id, x: p.x, y: p.y, width: p.w, height: p.h };
  }
  for (let i = 0; i < NODE_COUNT - panels.length; i++) {
    const id = `n-${i}`;
    nodes.push({ id, type: "c4", position: { x: 5000 + i, y: 5000 }, data: {} });
    components[id] = { id, name: id, type: "container", parentId: null };
    nodeLayouts[id] = { elementId: id, x: 5000 + i, y: 5000 };
  }

  const diagram = {
    id: "hotpath-diagram",
    name: "hotpath",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts,
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    folderId: null,
  } as unknown as Diagram;

  return { nodes, diagram };
}

/**
 * The gesture commits through one batchCommitNodeDrag call (see
 * useNodeDragParenting.singleCommit.test.tsx). These tests are about WHICH
 * parent and WHICH relative position the gesture decides on, so they read that
 * decision out of the single payload.
 */
function entryFor(mock: { mock: { calls: unknown[][] } }, nodeId: string) {
  const entries = (mock.mock.calls[0]?.[0] ?? []) as Array<{
    nodeId: string;
    newParentId: string | null;
    newPosition: { x: number; y: number };
  }>;
  return entries.find((e) => e.nodeId === nodeId);
}

function dragFrame(id: string, x: number, y: number): NodeChange {
  return { type: "position", id, position: { x, y }, dragging: true } as NodeChange;
}

describe("useNodeDragParenting hot path", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not scan the node list on drag frames after the first", () => {
    const { nodes, diagram } = buildFixture();
    const counting = countingArray(nodes);

    const { result } = renderHook(() =>
      useNodeDragParenting({
        diagram,
        nodes: counting.array,
        updateNodeLayout: vi.fn(),
        batchUpdateNodeLayouts: vi.fn(),
        batchCommitNodeDrag: vi.fn(),
      }),
    );

    // first frame: the gesture index may be built here, one pass over the nodes
    act(() => {
      result.current.onNodesChange([dragFrame("n-0", 300, 300)]);
    });

    counting.reset();

    // every frame after that must be O(1) in the number of nodes
    act(() => {
      for (let i = 1; i <= 12; i++) {
        result.current.onNodesChange([dragFrame("n-0", 300 + i * 15, 300 + i * 15)]);
      }
    });

    expect(counting.scans()).toBe(0);
  });

  it("commits to the innermost panel of a three-level nest", () => {
    const { nodes, diagram } = buildFixture();
    const batchCommitNodeDrag = vi.fn();
    const { result } = renderHook(() =>
      useNodeDragParenting({
        diagram,
        nodes,
        updateNodeLayout: vi.fn(),
        batchUpdateNodeLayouts: vi.fn(),
        batchCommitNodeDrag,
      }),
    );

    // P0 abs (0,0) / P1 abs (100,100) / P2 abs (200,200), 900x900.
    // A point at (400,400) is inside all three — the innermost must win.
    act(() => {
      result.current.onNodesChange([dragFrame("n-0", 400, 400)]);
    });
    act(() => {
      result.current.onNodeDragStop(null, {
        id: "n-0",
        type: "c4",
        position: { x: 400, y: 400 },
        data: {},
      } as Node);
    });

    expect(batchCommitNodeDrag).toHaveBeenCalledTimes(1);
    expect(entryFor(batchCommitNodeDrag, "n-0")).toEqual({
      nodeId: "n-0",
      newParentId: "P2",
      newPosition: { x: 200, y: 200 },
    });
  });

  it("drops on the canvas when the pointer is outside every panel", () => {
    const { nodes, diagram } = buildFixture();
    const batchCommitNodeDrag = vi.fn();
    const { result } = renderHook(() =>
      useNodeDragParenting({
        diagram,
        nodes,
        updateNodeLayout: vi.fn(),
        batchUpdateNodeLayouts: vi.fn(),
        batchCommitNodeDrag,
      }),
    );

    act(() => {
      result.current.onNodesChange([dragFrame("n-0", 9000, 9000)]);
    });
    act(() => {
      result.current.onNodeDragStop(null, {
        id: "n-0",
        type: "c4",
        position: { x: 9000, y: 9000 },
        data: {},
      } as Node);
    });

    expect(entryFor(batchCommitNodeDrag, "n-0")).toEqual({
      nodeId: "n-0",
      newParentId: null,
      newPosition: { x: 9000, y: 9000 },
    });
  });

  it("never makes a dragged panel a child of its own descendant", () => {
    const { nodes, diagram } = buildFixture();
    const batchCommitNodeDrag = vi.fn();
    const { result } = renderHook(() =>
      useNodeDragParenting({
        diagram,
        nodes,
        updateNodeLayout: vi.fn(),
        batchUpdateNodeLayouts: vi.fn(),
        batchCommitNodeDrag,
      }),
    );

    // P0 is the root panel; dropping it on a point inside its own descendant P2
    // must keep it at the canvas root, not reparent it under P2.
    act(() => {
      result.current.onNodeDragStop(null, {
        id: "P0",
        type: "panel",
        position: { x: 400, y: 400 },
        data: {},
        style: { width: 4000, height: 4000 },
      } as Node);
    });

    expect(entryFor(batchCommitNodeDrag, "P0")).toEqual({
      nodeId: "P0",
      newParentId: null,
      newPosition: { x: 400, y: 400 },
    });
  });
});
