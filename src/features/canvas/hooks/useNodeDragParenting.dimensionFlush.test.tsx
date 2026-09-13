import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { Node, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { useNodeDragParenting } from "./useNodeDragParenting";

/**
 * React Flow re-measures nodes through a ResizeObserver, so a single store
 * change can produce one dimension change per node on screen. Those were
 * batched into a Map and then written one store call at a time -- and every
 * store call serialises the whole workspace. Measured on a production build
 * with 400 nodes, one arrow-key nudge produced 800 store writes and 838
 * JSON.stringify calls; the flush is where 800 of them came from.
 *
 * The batch has to reach the store as one write.
 */
const NODE_COUNT = 50;

function buildFixture() {
  const components: Record<string, unknown> = {};
  const nodeLayouts: Record<string, unknown> = {};
  const nodes: Node[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const id = `n-${i}`;
    nodes.push({ id, type: "c4", position: { x: i * 10, y: 0 }, data: {} });
    components[id] = { id, name: id, type: "container", parentId: null };
    nodeLayouts[id] = { elementId: id, x: i * 10, y: 0 };
  }
  const diagram = {
    id: "dimension-flush-diagram",
    name: "dimension flush",
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

const dimensionChange = (id: string, width: number, height: number): NodeChange =>
  ({ type: "dimensions", id, dimensions: { width, height }, resizing: false }) as NodeChange;

/** Runs whatever the hook scheduled on the next animation frame. */
async function drainAnimationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dimension flush", () => {
  it("writes a whole batch of re-measured nodes in one store call", async () => {
    const { nodes, diagram } = buildFixture();
    const updateNodeLayout = vi.fn();
    const batchUpdateNodeLayouts = vi.fn();

    const { result } = renderHook(() =>
      useNodeDragParenting({
        diagram,
        nodes,
        updateNodeLayout,
        batchUpdateNodeLayouts,
        batchCommitNodeDrag: vi.fn(),
      }),
    );

    act(() => {
      result.current.onNodesChange(nodes.map((n, i) => dimensionChange(n.id, 100 + i, 50 + i)));
    });
    await drainAnimationFrame();

    const storeCalls =
      updateNodeLayout.mock.calls.length + batchUpdateNodeLayouts.mock.calls.length;
    expect(storeCalls).toBe(1);
    expect(batchUpdateNodeLayouts).toHaveBeenCalledTimes(1);
    expect(batchUpdateNodeLayouts.mock.calls[0][0]).toHaveLength(NODE_COUNT);
  });

  it("carries each node's measured size and its stored position", async () => {
    const { nodes, diagram } = buildFixture();
    const batchUpdateNodeLayouts = vi.fn();

    const { result } = renderHook(() =>
      useNodeDragParenting({
        diagram,
        nodes,
        updateNodeLayout: vi.fn(),
        batchUpdateNodeLayouts,
        batchCommitNodeDrag: vi.fn(),
      }),
    );

    act(() => {
      result.current.onNodesChange([dimensionChange("n-3", 111, 222)]);
    });
    await drainAnimationFrame();

    expect(batchUpdateNodeLayouts).toHaveBeenCalledWith([
      { elementId: "n-3", position: { x: 30, y: 0 }, dimensions: { width: 111, height: 222 } },
    ]);
  });

  it("writes nothing when nothing was re-measured", async () => {
    const { nodes, diagram } = buildFixture();
    const batchUpdateNodeLayouts = vi.fn();
    const updateNodeLayout = vi.fn();

    renderHook(() =>
      useNodeDragParenting({
        diagram,
        nodes,
        updateNodeLayout,
        batchUpdateNodeLayouts,
        batchCommitNodeDrag: vi.fn(),
      }),
    );
    await drainAnimationFrame();

    expect(batchUpdateNodeLayouts).not.toHaveBeenCalled();
    expect(updateNodeLayout).not.toHaveBeenCalled();
  });
});
