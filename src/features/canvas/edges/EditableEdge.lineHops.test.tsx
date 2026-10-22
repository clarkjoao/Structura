import { act, render } from "@testing-library/react";
import { Position, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { beforeAll, describe, expect, it } from "vitest";
import { LineHopsProvider } from "../contexts/LineHopsContext";
import { EdgeLabelPortalHost, EdgeLabelPortalProvider } from "./EdgeLabelPortal";
import EditableEdge from "./EditableEdge";
import type { EdgeData } from "./data/edgeData.types";

/**
 * Two step edges that cross, drawn on one surface: the one crossing
 * horizontally hops over the other. End to end through the registry, so a
 * wiring mistake (no provider, wrong id, a path nobody publishes) fails here
 * rather than only in the browser.
 */

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

type EdgeProps = Parameters<typeof EditableEdge>[0];

// Straight across at y=50, with a corner list that keeps it straight.
const horizontal = {
  id: "h",
  source: "a",
  target: "b",
  sourceX: 0,
  sourceY: 50,
  targetX: 200,
  targetY: 50,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  data: { label: "", connectionId: "h", layoutPoints: [{ id: "c", x: 150, y: 50 }] } as EdgeData,
} as unknown as EdgeProps;

// Right, down through y=50 at x=100, right again.
const vertical = {
  id: "v",
  source: "c",
  target: "d",
  sourceX: 60,
  sourceY: 0,
  targetX: 160,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  data: {
    label: "",
    connectionId: "v",
    layoutPoints: [
      { id: "c1", x: 100, y: 0 },
      { id: "c2", x: 100, y: 100 },
    ],
  } as EdgeData,
} as unknown as EdgeProps;

function Surface({ withProvider }: { withProvider: boolean }) {
  const edges = (
    <svg>
      <EditableEdge {...horizontal} />
      <EditableEdge {...vertical} />
    </svg>
  );
  return (
    <ReactFlowProvider>
      <EdgeLabelPortalProvider>
        <ReactFlow nodes={[]} edges={[]}>
          <EdgeLabelPortalHost />
        </ReactFlow>
        {withProvider ? <LineHopsProvider>{edges}</LineHopsProvider> : edges}
      </EdgeLabelPortalProvider>
    </ReactFlowProvider>
  );
}

const pathOf = (container: HTMLElement, id: string) =>
  container.querySelector(`path.react-flow__edge-path[id="${id}"]`)?.getAttribute("d") ?? "";

async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });
}

describe("EditableEdge line hops", () => {
  it("hops the horizontal edge over the vertical one", async () => {
    const { container } = render(<Surface withProvider />);
    await nextFrame();

    expect(pathOf(container, "h")).toContain(" A ");
    expect(pathOf(container, "v")).not.toContain(" A ");
  });

  it("draws plain step paths on a surface without the provider", async () => {
    const { container } = render(<Surface withProvider={false} />);
    await nextFrame();

    expect(pathOf(container, "h")).not.toContain(" A ");
  });
});
