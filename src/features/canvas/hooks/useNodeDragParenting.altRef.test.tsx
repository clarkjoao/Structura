import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Node, NodeChange } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import "@/features/elements/bootstrap";
import { useNodeDragParenting } from "./useNodeDragParenting";

/**
 * Alt+drag drops a reference where the node is let go, and moves nothing:
 * the node stays where it was, and so does everything else selected.
 */
function buildFixture() {
  const components: Record<string, unknown> = {
    zone: { id: "zone", name: "zone", type: "panel", parentId: null },
    auth: { id: "auth", name: "Auth", type: "container", parentId: null },
    other: { id: "other", name: "Other", type: "container", parentId: null },
    note: { id: "note", name: "Note", type: "note", parentId: null },
    ref: { id: "ref", name: "Auth", type: "shared-ref", refOf: "auth", parentId: null },
  };
  const nodeLayouts: Record<string, unknown> = {
    zone: { elementId: "zone", x: 1000, y: 1000, width: 800, height: 600 },
    auth: { elementId: "auth", x: 0, y: 0 },
    other: { elementId: "other", x: 0, y: 300 },
    note: { elementId: "note", x: 0, y: 600 },
    ref: { elementId: "ref", x: 0, y: 900 },
  };
  const nodes: Node[] = [
    {
      id: "zone",
      type: "panel",
      position: { x: 1000, y: 1000 },
      data: {},
      style: { width: 800, height: 600 },
    },
    { id: "auth", type: "c4", position: { x: 0, y: 0 }, data: {} },
    { id: "other", type: "c4", position: { x: 0, y: 300 }, data: {}, selected: true },
    { id: "note", type: "note", position: { x: 0, y: 600 }, data: {} },
    { id: "ref", type: "shared-ref", position: { x: 0, y: 900 }, data: {} },
  ];
  const diagram = {
    id: "alt-ref",
    name: "alt ref",
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

function setup(addSharedRef = vi.fn((): { id: string } | null => ({ id: "ref" }))) {
  const { nodes, diagram } = buildFixture();
  const batchCommitNodeDrag = vi.fn();
  const { result } = renderHook(() =>
    useNodeDragParenting({
      diagram,
      nodes,
      updateNodeLayout: vi.fn(),
      batchUpdateNodeLayouts: vi.fn(),
      batchCommitNodeDrag,
      addSharedRef,
    }),
  );
  const drop = (id: string, type: string, x: number, y: number, altKey: boolean) => {
    act(() => result.current.onNodesChange([frame(id, x, y)]));
    act(() =>
      result.current.onNodeDragStop({ altKey }, {
        id,
        type,
        position: { x, y },
        data: {},
      } as Node),
    );
  };
  return { drop, addSharedRef, batchCommitNodeDrag };
}

describe("Alt+drag", () => {
  it("drops a reference where the node is let go, and moves nothing", () => {
    const { drop, addSharedRef, batchCommitNodeDrag } = setup();
    drop("auth", "c4", 400, 120, true);
    expect(addSharedRef).toHaveBeenCalledWith("auth", null, { x: 400, y: 120 });
    expect(batchCommitNodeDrag).not.toHaveBeenCalled();
  });

  it("drops it inside the panel it lands on, in the panel's coordinates", () => {
    const { drop, addSharedRef } = setup();
    drop("auth", "c4", 1200, 1100, true);
    expect(addSharedRef).toHaveBeenCalledWith("auth", "zone", { x: 200, y: 100 });
  });

  it("is a plain drag without Alt", () => {
    const { drop, addSharedRef, batchCommitNodeDrag } = setup();
    drop("auth", "c4", 400, 120, false);
    expect(addSharedRef).not.toHaveBeenCalled();
    expect(batchCommitNodeDrag).toHaveBeenCalledTimes(1);
  });

  it("is a plain drag for what cannot be referenced", () => {
    const { drop, addSharedRef, batchCommitNodeDrag } = setup();
    drop("note", "note", 400, 700, true);
    expect(addSharedRef).not.toHaveBeenCalled();
    expect(batchCommitNodeDrag).toHaveBeenCalledTimes(1);
  });

  it("is a plain drag for a reference: only the original is referenced", () => {
    const { drop, addSharedRef, batchCommitNodeDrag } = setup();
    drop("ref", "shared-ref", 400, 900, true);
    expect(addSharedRef).not.toHaveBeenCalled();
    expect(batchCommitNodeDrag).toHaveBeenCalledTimes(1);
  });

  it("falls back to a move when the store refuses the reference", () => {
    const { drop, batchCommitNodeDrag } = setup(vi.fn((): { id: string } | null => null));
    drop("auth", "c4", 400, 120, true);
    expect(batchCommitNodeDrag).toHaveBeenCalledTimes(1);
  });
});
