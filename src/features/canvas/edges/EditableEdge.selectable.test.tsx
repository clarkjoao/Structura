import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { Position, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { beforeAll, describe, expect, it } from "vitest";
import { ElementsSelectableProvider } from "../contexts/ElementsSelectableContext";
import { EdgeLabelPortalHost, EdgeLabelPortalProvider } from "./EdgeLabelPortal";
import EditableEdge from "./EditableEdge";
import type { EdgeData } from "./data/edgeData.types";

/**
 * Whether the surface is editable is one value for the whole canvas. Reading it
 * through React Flow's `useStore` inside the edge makes it one store
 * subscription per visible edge, and React Flow runs every subscriber's
 * selector on every store write — including the `setNodes` of each drag frame.
 * Measured on the 400-node / 439-edge fixture: 287 reads of `elementsSelectable`
 * per drag frame before, 2 after (React Flow's own two subscribers).
 */

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const edgeProps = {
  id: "e1",
  source: "a",
  target: "b",
  sourceX: 0,
  sourceY: 0,
  targetX: 120,
  targetY: 80,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: true,
  data: { label: "calls", connectionId: "c1" } as EdgeData,
} as unknown as Parameters<typeof EditableEdge>[0];

function Surface({ selectable }: { selectable: boolean }) {
  return (
    <ReactFlowProvider>
      <EdgeLabelPortalProvider>
        <ElementsSelectableProvider value={selectable}>
          <ReactFlow nodes={[]} edges={[]}>
            <EdgeLabelPortalHost />
          </ReactFlow>
          <svg>
            <EditableEdge {...edgeProps} />
          </svg>
        </ElementsSelectableProvider>
      </EdgeLabelPortalProvider>
    </ReactFlowProvider>
  );
}

describe("EditableEdge interactivity", () => {
  it("offers edit affordances on a selectable surface", () => {
    render(<Surface selectable />);
    expect(screen.queryByRole("button", { name: "Delete connection" })).not.toBeNull();
  });

  it("offers none on a read-only surface, even for a selected edge", () => {
    render(<Surface selectable={false} />);
    expect(screen.queryByRole("button", { name: "Delete connection" })).toBeNull();
  });

  it("does not subscribe to the React Flow store per edge", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/canvas/edges/EditableEdge.tsx"),
      "utf8",
    );
    const importsUseStore = /import\s*\{[^}]*\buseStore\b[^}]*\}\s*from\s*["']@xyflow\/react["']/s;
    expect(importsUseStore.test(source)).toBe(false);
    expect(/\buseStore\s*\(/.test(source)).toBe(false);
  });
});
