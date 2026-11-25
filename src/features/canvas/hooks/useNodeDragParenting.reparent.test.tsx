import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Node, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { useNodeDragParenting } from "./useNodeDragParenting";

/**
 * Dropping a child: it may move into a panel nested in its own group, but leaving the group (a
 * sibling panel, the ancestor around it, the top level) is an explicit ungroup, never a drag.
 * The drop point is the node's centre.
 *
 *   P0 (0,0 2000×2000)
 *   ├── P1 (100,100 600×600)  ── L (relative 50,50, 100×50)
 *   │    └── P1a (300,300 200×200, relative to P1)
 *   └── P2 (1000,100 600×600)
 */
function setup() {
  const components: Record<string, unknown> = {};
  const nodeLayouts: Record<string, unknown> = {};
  const nodes: Node[] = [];
  const panels = [
    { id: "P0", parentId: null, x: 0, y: 0, w: 2000, h: 2000 },
    { id: "P1", parentId: "P0", x: 100, y: 100, w: 600, h: 600 },
    { id: "P1a", parentId: "P1", x: 300, y: 300, w: 200, h: 200 },
    { id: "P2", parentId: "P0", x: 1000, y: 100, w: 600, h: 600 },
  ];
  for (const p of panels) {
    nodes.push({
      id: p.id,
      type: "panel",
      position: { x: p.x, y: p.y },
      data: {},
      style: { width: p.w, height: p.h },
      ...(p.parentId ? { parentId: p.parentId } : {}),
    });
    components[p.id] = { id: p.id, name: p.id, type: "panel", parentId: p.parentId };
    nodeLayouts[p.id] = { elementId: p.id, x: p.x, y: p.y, width: p.w, height: p.h };
  }
  nodes.push({ id: "L", type: "c4", position: { x: 50, y: 50 }, parentId: "P1", data: {} });
  components["L"] = { id: "L", name: "L", type: "container", parentId: "P1" };
  nodeLayouts["L"] = { elementId: "L", x: 50, y: 50 };
  const diagram = {
    id: "d",
    name: "d",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts,
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    folderId: null,
  } as unknown as Diagram;
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
  /** Drop L at a position relative to P1 and return where it was committed. */
  const drop = (x: number, y: number) => {
    const node = {
      id: "L",
      type: "c4",
      parentId: "P1",
      position: { x, y },
      measured: { width: 100, height: 50 },
      data: {},
    } as Node;
    const index = nodes.findIndex((n) => n.id === "L");
    nodes[index] = node;
    act(() => {
      result.current.onNodesChange([
        { type: "position", id: "L", position: { x, y }, dragging: true } as NodeChange,
      ]);
    });
    act(() => result.current.onNodeDragStop(null, node));
    const calls = batchCommitNodeDrag.mock.calls;
    return calls[calls.length - 1]![0][0];
  };
  return { drop };
}

describe("dropping a child: it never leaves its group by dragging", () => {
  it("keeps its parent when dropped over a sibling panel", () => {
    // absolute (100+950, 100+100) = (1050, 200) is inside P2, but leaving P1 is an ungroup
    expect(setup().drop(950, 100)).toEqual({
      nodeId: "L",
      newParentId: "P1",
      newPosition: { x: 950, y: 100 },
    });
  });

  it("moves into a panel nested in its own", () => {
    // centre at absolute (100+350+50, 100+350+25) = (500, 475), inside P1a at (400,400)
    expect(setup().drop(350, 350)).toMatchObject({
      newParentId: "P1a",
      newPosition: { x: 50, y: 50 },
    });
  });

  it("stays when dropped inside its own panel", () => {
    expect(setup().drop(60, 60)).toEqual({
      nodeId: "L",
      newParentId: "P1",
      newPosition: { x: 60, y: 60 },
    });
  });

  it("keeps its parent when dropped in the ancestor around it", () => {
    expect(setup().drop(700, 700)).toMatchObject({ newParentId: "P1" });
  });

  it("keeps its parent when dropped outside everything", () => {
    expect(setup().drop(2500, 2500)).toMatchObject({ newParentId: "P1" });
  });
});
