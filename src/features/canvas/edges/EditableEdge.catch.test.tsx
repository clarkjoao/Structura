import { render } from "@testing-library/react";
import { Position, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { beforeAll, describe, expect, it } from "vitest";
import { EdgeStyle, StrokeStyle } from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { ElementsSelectableProvider } from "../contexts/ElementsSelectableContext";
import { EdgeLabelPortalHost, EdgeLabelPortalProvider } from "./EdgeLabelPortal";
import EditableEdge from "./EditableEdge";
import type { EdgeData } from "./data/edgeData.types";

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

/** The drawn path of one edge with the given data. */
function drawn(data: Partial<EdgeData>) {
  const props = {
    id: "e",
    source: "a",
    target: "b",
    sourceX: 0,
    sourceY: 0,
    targetX: 300,
    targetY: 80,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selected: false,
    data: { connectionId: "e", label: "Catch · States.ALL", ...data },
  } as unknown as Parameters<typeof EditableEdge>[0];
  const view = render(
    <ReactFlowProvider>
      <EdgeLabelPortalProvider>
        <ElementsSelectableProvider value={false}>
          <ReactFlow nodes={[]} edges={[]}>
            <EdgeLabelPortalHost />
          </ReactFlow>
          <svg>
            <EditableEdge {...props} />
          </svg>
        </ElementsSelectableProvider>
      </EdgeLabelPortalProvider>
    </ReactFlowProvider>,
  );
  const path = view.container.querySelector("path.react-flow__edge-path") as SVGPathElement;
  const result = {
    d: path.getAttribute("d"),
    stroke: path.style.stroke,
    dash: path.style.strokeDasharray,
  };
  view.unmount();
  return result;
}

describe("a catch edge on the canvas", () => {
  it("is routed like a step and drawn dashed in the destructive red", () => {
    const catcher = drawn({ edgeStyle: EdgeStyle.Catch, strokeStyle: StrokeStyle.Solid });
    const step = drawn({ edgeStyle: EdgeStyle.EditableStep, strokeStyle: StrokeStyle.Solid });
    expect(catcher.d).toBe(step.d);
    // …and that route is the orthogonal one, not a straight line.
    expect(catcher.d).not.toBe(drawn({ edgeStyle: EdgeStyle.Straight }).d);
    expect(catcher.stroke).toBe("hsl(var(--destructive))");
    expect(catcher.dash).toBeTruthy();
    expect(step.dash).toBeFalsy();
    expect(step.stroke).not.toBe("hsl(var(--destructive))");
  });

  it("keeps a colour or stroke its author set", () => {
    const styled = drawn({
      edgeStyle: EdgeStyle.Catch,
      color: "#123456",
      connectionStyle: { strokeStyle: StrokeStyle.Solid },
    });
    expect(styled.stroke).toBe("rgb(18, 52, 86)");
    expect(styled.dash).toBeFalsy();
  });
});
