import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import "@/features/elements/bootstrap";
import { useNodeDragParenting } from "./useNodeDragParenting";

/**
 * Dropping a panel a little down and to the right froze the tab.
 *
 * Drag frames go straight to React Flow (`publishDragFrame`) without a render,
 * so the node list this hook holds still has the panel at its pre-drag place.
 * The drop hit-test did not exclude the dragged panel, found its new top-left
 * corner inside its own old box, and committed the panel as its own parent —
 * after which every walk up the parent chain looped forever.
 */
function buildFixture() {
  const panels = [
    { id: "P", x: 0, y: 0, w: 1000, h: 800 },
    { id: "Q", x: 1100, y: 0, w: 1000, h: 800 },
  ];
  const components: Record<string, unknown> = {};
  const nodeLayouts: Record<string, unknown> = {};
  const nodes: Node[] = [];
  for (const p of panels) {
    nodes.push({
      id: p.id,
      type: "panel",
      position: { x: p.x, y: p.y },
      data: {},
      style: { width: p.w, height: p.h },
    });
    components[p.id] = { id: p.id, name: p.id, type: "panel", parentId: null };
    nodeLayouts[p.id] = { elementId: p.id, x: p.x, y: p.y, width: p.w, height: p.h };
  }
  nodes.push({ id: "child", type: "c4", position: { x: 40, y: 70 }, parentId: "P", data: {} });
  components.child = { id: "child", name: "child", type: "container", parentId: "P" };
  nodeLayouts.child = { elementId: "child", x: 40, y: 70 };

  const diagram = {
    id: "panel-self-drop",
    name: "panel self drop",
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

function setup() {
  const { nodes, diagram } = buildFixture();
  const batchCommitNodeDrag = vi.fn();
  const { result } = renderHook(() =>
    useNodeDragParenting({
      diagram,
      // The list as of the last render: P is still at (0, 0).
      nodes,
      updateNodeLayout: vi.fn(),
      batchUpdateNodeLayouts: vi.fn(),
      batchCommitNodeDrag,
    }),
  );
  return { result, nodes, batchCommitNodeDrag };
}

const dropped = (base: Node, x: number, y: number): Node => ({ ...base, position: { x, y } });

describe("useNodeDragParenting — dropping a panel", () => {
  it("never makes the dragged panel its own parent", () => {
    const { result, nodes, batchCommitNodeDrag } = setup();
    act(() => result.current.onNodeDragStop({}, dropped(nodes[0]!, 30, 15)));

    expect(batchCommitNodeDrag).toHaveBeenCalledTimes(1);
    const entries = batchCommitNodeDrag.mock.calls[0]![0] as Array<{
      nodeId: string;
      newParentId: string | null;
      newPosition: { x: number; y: number };
    }>;
    expect(entries).toEqual([{ nodeId: "P", newParentId: null, newPosition: { x: 30, y: 15 } }]);
  });

  it("still nests a panel dropped inside another panel", () => {
    const { result, nodes, batchCommitNodeDrag } = setup();
    act(() => result.current.onNodeDragStop({}, dropped(nodes[0]!, 1150, 50)));

    const entries = batchCommitNodeDrag.mock.calls[0]![0] as Array<{ newParentId: string | null }>;
    expect(entries[0]!.newParentId).toBe("Q");
  });

  it("never nests a dragged panel into another panel moving in the same selection", () => {
    const { nodes, diagram } = buildFixture();
    // Both panels selected and dragged together; the list still has their old places.
    const selected = nodes.map((n) => (n.type === "panel" ? { ...n, selected: true } : n));
    const batchCommitNodeDrag = vi.fn();
    const { result } = renderHook(() =>
      useNodeDragParenting({
        diagram,
        nodes: selected,
        updateNodeLayout: vi.fn(),
        batchUpdateNodeLayouts: vi.fn(),
        batchCommitNodeDrag,
      }),
    );
    // P's new corner lands inside Q's old box.
    act(() => result.current.onNodeDragStop({}, dropped(selected[0]!, 1150, 50)));

    const entries = batchCommitNodeDrag.mock.calls[0]![0] as Array<{
      nodeId: string;
      newParentId: string | null;
    }>;
    for (const entry of entries) expect(entry.newParentId).toBeNull();
  });
});
