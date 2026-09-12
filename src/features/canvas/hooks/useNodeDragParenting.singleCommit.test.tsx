import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Node, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { useNodeDragParenting } from "./useNodeDragParenting";

/**
 * One gesture is one store transaction.
 *
 * The commit used to fan out: commitNodeDrag for the node under the pointer,
 * batchCommitNodeDrag for the selected nodes that changed parent, and one
 * updateNodeLayout per selected node that did not. Each of those is a set() on
 * the diagram store, and each set() is the single most expensive thing the app
 * does. Two of them also push a structural history checkpoint, which never
 * coalesces -- so a multi-select drag that reparented took two undos.
 */
function buildFixture() {
  const components: Record<string, unknown> = {};
  const nodeLayouts: Record<string, unknown> = {};
  const nodes: Node[] = [];

  const panels = [
    { id: "P0", parentId: null, x: 0, y: 0, w: 4000, h: 4000 },
    { id: "P1", parentId: "P0", x: 100, y: 100, w: 900, h: 900 },
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

  // dragged: lands inside P1.  mover-reparent: also lands inside P1.
  // mover-stay: selected but stays on the canvas, far away.
  const leaves: Array<[string, number, number, boolean]> = [
    ["dragged", 300, 300, false],
    ["mover-reparent", 400, 400, true],
    ["mover-stay", 9000, 9000, true],
  ];
  for (const [id, x, y, selected] of leaves) {
    nodes.push({ id, type: "c4", position: { x, y }, data: {}, selected });
    components[id] = { id, name: id, type: "container", parentId: null };
    nodeLayouts[id] = { elementId: id, x, y };
  }

  const diagram = {
    id: "single-commit-diagram",
    name: "single commit",
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

const frame = (id: string, x: number, y: number): NodeChange =>
  ({ type: "position", id, position: { x, y }, dragging: true }) as NodeChange;

function setup() {
  const { nodes, diagram } = buildFixture();
  const batchCommitNodeDrag = vi.fn();
  const updateNodeLayout = vi.fn();
  const { result } = renderHook(() =>
    useNodeDragParenting({ diagram, nodes, updateNodeLayout, batchCommitNodeDrag }),
  );
  return { result, nodes, batchCommitNodeDrag, updateNodeLayout };
}

describe("useNodeDragParenting commit", () => {
  it("writes the whole multi-select gesture in a single store call", () => {
    const { result, batchCommitNodeDrag, updateNodeLayout } = setup();

    act(() => {
      result.current.onNodesChange([frame("dragged", 300, 300)]);
    });
    act(() => {
      result.current.onNodeDragStop(null, {
        id: "dragged",
        type: "c4",
        position: { x: 300, y: 300 },
        data: {},
      } as Node);
    });

    const totalStoreCalls =
      batchCommitNodeDrag.mock.calls.length + updateNodeLayout.mock.calls.length;
    expect(totalStoreCalls).toBe(1);
    expect(batchCommitNodeDrag).toHaveBeenCalledTimes(1);
  });

  it("carries every node the gesture moved, reparented or not", () => {
    const { result, batchCommitNodeDrag } = setup();

    act(() => {
      result.current.onNodesChange([frame("dragged", 300, 300)]);
    });
    act(() => {
      result.current.onNodeDragStop(null, {
        id: "dragged",
        type: "c4",
        position: { x: 300, y: 300 },
        data: {},
      } as Node);
    });

    const entries = batchCommitNodeDrag.mock.calls[0][0] as Array<{
      nodeId: string;
      newParentId: string | null;
      newPosition: { x: number; y: number };
    }>;
    const byId = Object.fromEntries(entries.map((e) => [e.nodeId, e]));

    expect(Object.keys(byId).sort()).toEqual(["dragged", "mover-reparent", "mover-stay"]);
    // P1 sits at absolute (100,100); a node at absolute (300,300) becomes (200,200) inside it
    expect(byId["dragged"]).toEqual({
      nodeId: "dragged",
      newParentId: "P1",
      newPosition: { x: 200, y: 200 },
    });
    expect(byId["mover-reparent"]).toEqual({
      nodeId: "mover-reparent",
      newParentId: "P1",
      newPosition: { x: 300, y: 300 },
    });
    // the node that did not change parent keeps its parent and its position
    expect(byId["mover-stay"]).toEqual({
      nodeId: "mover-stay",
      newParentId: null,
      newPosition: { x: 9000, y: 9000 },
    });
  });

  it("writes nothing when the gesture moved nothing it is allowed to move", () => {
    const { result, batchCommitNodeDrag, updateNodeLayout } = setup();

    act(() => {
      result.current.onNodeDragStop(null, {
        id: "endpoint-x",
        type: "endpoint",
        position: { x: 10, y: 10 },
        data: {},
      } as Node);
    });

    expect(batchCommitNodeDrag).not.toHaveBeenCalled();
    expect(updateNodeLayout).not.toHaveBeenCalled();
  });
});
