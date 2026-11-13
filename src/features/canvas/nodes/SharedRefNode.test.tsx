import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider, type Node, type NodeProps } from "@xyflow/react";
import SharedRefNode, { type SharedRefNodeData } from "./SharedRefNode";

/**
 * A reference the user made is a card with a `ref` chip; one the auto-layout
 * made is a compact pill with the glyph and the name only.
 */

function renderRef(data: Partial<SharedRefNodeData>) {
  const props: NodeProps<Node<SharedRefNodeData>> = {
    id: "r",
    type: "shared-ref",
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    draggable: false,
    selectable: false,
    deletable: false,
    data: {
      elementId: "r",
      name: "Auth",
      accent: "#336699",
      dangling: false,
      incomingCount: 1,
      outgoingCount: 1,
      ...data,
    },
  };
  return render(
    <ReactFlowProvider>
      <SharedRefNode {...props} />
    </ReactFlowProvider>,
  );
}

describe("SharedRefNode", () => {
  it("draws a user's reference as a card with its chip", () => {
    const view = renderRef({});
    expect(view.getByText("Auth")).toBeTruthy();
    expect(view.queryByText("ref")).toBeTruthy();
    expect(view.container.querySelector("[data-compact]")).toBeNull();
  });

  it("draws an automatic reference as a pill, without the chip", () => {
    const view = renderRef({ auto: true });
    expect(view.getByText("Auth")).toBeTruthy();
    expect(view.queryByText("ref")).toBeNull();
    expect(view.container.querySelector("[data-compact]")).not.toBeNull();
  });
});
