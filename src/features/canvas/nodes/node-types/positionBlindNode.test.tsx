import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";
import "@/features/elements/bootstrap";
import { positionBlindNode, sameNodePropsIgnoringPosition } from "./positionBlindNode";
import { getElement } from "@/features/elements/element.registry";
import { getNodeTypesSnapshot } from "./registry";

/**
 * A node dragged with many others gets new `positionAbsoluteX/Y` on every
 * frame. React Flow moves the node itself, so its renderer must not run again
 * for that — measured on 400 nodes with 169 dragged together, it was most of
 * every frame's long task.
 */

function props(overrides: Partial<NodeProps> = {}): NodeProps {
  return {
    id: "a",
    type: "system",
    data: { name: "A" },
    selected: false,
    selectable: true,
    deletable: true,
    draggable: true,
    isConnectable: true,
    dragging: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    ...overrides,
  };
}

describe("positionBlindNode", () => {
  it("does not re-render a node whose only change is where it is", () => {
    let renders = 0;
    const Renderer = () => {
      renders += 1;
      return null;
    };
    const Node = positionBlindNode(Renderer);
    const data = { name: "A" };
    const { rerender } = render(<Node {...props({ data })} />);
    rerender(<Node {...props({ data, positionAbsoluteX: 40, positionAbsoluteY: 15 })} />);
    rerender(<Node {...props({ data, positionAbsoluteX: 80, positionAbsoluteY: 30 })} />);

    expect(renders).toBe(1);
  });

  it("re-renders for anything it draws: data, selection, dragging", () => {
    let renders = 0;
    const Renderer = () => {
      renders += 1;
      return null;
    };
    const Node = positionBlindNode(Renderer);
    const data = { name: "A" };
    const { rerender } = render(<Node {...props({ data })} />);
    rerender(<Node {...props({ data: { name: "B" } })} />);
    rerender(<Node {...props({ data: { name: "B" }, selected: true })} />);
    rerender(<Node {...props({ data: { name: "B" }, selected: true, dragging: true })} />);

    expect(renders).toBe(4);
  });

  it("treats a prop that appears or disappears as a change", () => {
    const base = props();
    expect(sameNodePropsIgnoringPosition(base, { ...base, parentId: "p" })).toBe(false);
    expect(sameNodePropsIgnoringPosition({ ...base, width: 10 }, { ...base, height: 10 })).toBe(
      false,
    );
  });

  it("wraps a renderer once, so nodeTypes keeps its identities", () => {
    const Renderer = () => null;
    expect(positionBlindNode(Renderer)).toBe(positionBlindNode(Renderer));
  });

  it("is what the nodeTypes map renders a registered element through", () => {
    const canvas = getElement("system")!.canvas;
    const entry = getNodeTypesSnapshot()[canvas.rfType];

    expect(entry).toBe(positionBlindNode(canvas.component));
    expect(entry).not.toBe(canvas.component);
  });
});
