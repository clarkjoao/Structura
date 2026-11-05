import { act, render } from "@testing-library/react";
import { LineHopsProvider } from "../contexts/LineHopsContext";
import { Position, ReactFlow, ReactFlowProvider, type Edge, type EdgeProps } from "@xyflow/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CanvasLodContext, type CanvasLod } from "../contexts/canvasLod";
import { EdgeLabelRevealProvider } from "../contexts/EdgeLabelRevealContext";
import { EdgeLabelPortalHost, EdgeLabelPortalProvider } from "./EdgeLabelPortal";
import EditableEdge from "./EditableEdge";
import type { EdgeData } from "./data/edgeData.types";
import { restingEdgePath } from "./geometry/restingEdgePath";
import { EdgeStyle } from "@/features/diagram";

/**
 * At the far level of detail an edge nothing points at draws only its stroke —
 * on exactly the path the full edge draws — and keeps everything else for the
 * edges the user is working with.
 */
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

const layoutPoints = [
  { id: "p1", x: 60, y: 0 },
  { id: "p2", x: 60, y: -200 },
  { id: "p3", x: 100, y: -200 },
  { id: "p4", x: 100, y: 80 },
];

function edgeProps(selected: boolean): EdgeProps<Edge<EdgeData, "editable">> {
  return {
    id: "e1",
    source: "a",
    target: "b",
    sourceX: 0,
    sourceY: 0,
    targetX: 120,
    targetY: 80,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selected,
    data: { label: "calls", connectionId: "c1", layoutPoints },
  };
}

function Surface({
  lod,
  selected = false,
  revealed = new Set<string>(),
}: {
  lod: CanvasLod;
  selected?: boolean;
  revealed?: ReadonlySet<string>;
}) {
  return (
    <ReactFlowProvider>
      <EdgeLabelPortalProvider>
        <CanvasLodContext.Provider value={lod}>
          <EdgeLabelRevealProvider value={revealed}>
            <ReactFlow nodes={[]} edges={[]}>
              <EdgeLabelPortalHost />
            </ReactFlow>
            <svg>
              <EditableEdge {...edgeProps(selected)} />
            </svg>
          </EdgeLabelRevealProvider>
        </CanvasLodContext.Provider>
      </EdgeLabelPortalProvider>
    </ReactFlowProvider>
  );
}

const drawnPath = (container: HTMLElement) =>
  container.querySelector("svg .react-flow__edge-path")?.getAttribute("d");
const label = (container: HTMLElement) => container.querySelector("[data-edge-label]");

describe("EditableEdge level of detail", () => {
  it("draws the full edge at full detail", () => {
    const { container } = render(<Surface lod="full" />);
    expect(label(container)).not.toBeNull();
  });

  it("draws only the stroke at far detail, on the same path", () => {
    const full = render(<Surface lod="full" />);
    const fullPath = drawnPath(full.container);
    full.unmount();

    const { container } = render(<Surface lod="far" />);
    expect(label(container)).toBeNull();
    expect(drawnPath(container)).toBe(fullPath);
  });

  it("keeps a selected edge in full at far detail", () => {
    const { container } = render(<Surface lod="far" selected />);
    expect(label(container)).not.toBeNull();
  });

  it("keeps an edge revealed by a selected end in full at far detail", () => {
    const { container } = render(<Surface lod="far" revealed={new Set(["c1"])} />);
    expect(label(container)).not.toBeNull();
  });
});

describe("line hops at far detail", () => {
  // A horizontal edge and a vertical one crossing it: the horizontal one hops.
  function crossing(id: string, from: [number, number], to: [number, number]) {
    const props: EdgeProps<Edge<EdgeData, "editable">> = {
      id,
      source: `${id}-s`,
      target: `${id}-t`,
      sourceX: from[0],
      sourceY: from[1],
      targetX: to[0],
      targetY: to[1],
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      selected: false,
      data: {
        label: "",
        connectionId: id,
        layoutPoints: [
          { id: `${id}-1`, x: (from[0] + to[0]) / 2, y: from[1] },
          { id: `${id}-2`, x: (from[0] + to[0]) / 2, y: to[1] },
        ],
      },
    };
    return <EditableEdge {...props} />;
  }

  async function pathOfHorizontal(lod: CanvasLod) {
    const view = render(
      <ReactFlowProvider>
        <EdgeLabelPortalProvider>
          <CanvasLodContext.Provider value={lod}>
            <LineHopsProvider>
              <ReactFlow nodes={[]} edges={[]}>
                <EdgeLabelPortalHost />
              </ReactFlow>
              <svg>
                {crossing("h", [0, 100], [400, 100])}
                {crossing("v", [180, 0], [220, 300])}
              </svg>
            </LineHopsProvider>
          </CanvasLodContext.Provider>
        </EdgeLabelPortalProvider>
      </ReactFlowProvider>,
    );
    // The registry recomputes on the next animation frame.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const d = view.container.querySelector("svg .react-flow__edge-path")?.getAttribute("d") ?? "";
    view.unmount();
    return d;
  }

  it("hops at full detail and computes no hops at far detail", async () => {
    expect(await pathOfHorizontal("full")).toContain(" A ");
    expect(await pathOfHorizontal("far")).not.toContain(" A ");
  });
});

describe("restingEdgePath", () => {
  it("is the stored step route when the edge has waypoints", () => {
    const path = restingEdgePath({
      edgeStyle: EdgeStyle.EditableStep,
      vertical: false,
      source: { x: 0, y: 0 },
      target: { x: 120, y: 80 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      layoutPoints,
    });
    expect(path.startsWith("M 0 0")).toBe(true);
    expect(path).toContain("-200");
  });
});
