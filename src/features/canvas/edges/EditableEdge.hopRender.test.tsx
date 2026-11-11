import { act, render } from "@testing-library/react";
import { Position, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LineHopsProvider } from "../contexts/LineHopsContext";
import { EdgeLabelPortalHost, EdgeLabelPortalProvider } from "./EdgeLabelPortal";
import EditableEdge from "./EditableEdge";
import type { EdgeData } from "./data/edgeData.types";

/**
 * Hops reach an edge a frame after the paths they depend on, so while nodes
 * are dragged every moving edge hears about new hops on every frame. That
 * update must redraw the path, not re-run the whole edge: its gesture hooks,
 * store reads and label. Measured dragging 91 of 400 nodes, the second full
 * render per frame was a third of the gesture's main-thread time.
 */

const edgeRenders = vi.hoisted(() => new Map<string, number>());
vi.mock("./interaction/useSegmentDrag", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./interaction/useSegmentDrag")>();
  return {
    ...actual,
    useSegmentDrag: (...args: Parameters<typeof actual.useSegmentDrag>) => {
      edgeRenders.set(args[0], (edgeRenders.get(args[0]) ?? 0) + 1);
      return actual.useSegmentDrag(...args);
    },
  };
});

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

function Surface() {
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
        <LineHopsProvider>{edges}</LineHopsProvider>
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

describe("EditableEdge line hops arriving", () => {
  it("redraw the hopping path without rendering the edge again", async () => {
    const { container } = render(<Surface />);
    const beforeHops = edgeRenders.get("h") ?? 0;
    expect(pathOf(container, "h")).not.toContain(" A ");

    await nextFrame();

    expect(pathOf(container, "h")).toContain(" A ");
    expect(edgeRenders.get("h")).toBe(beforeHops);
  });
});
