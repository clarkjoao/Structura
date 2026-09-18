import { render } from "@testing-library/react";
import { Position, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useDiagramStore, type Component, type Diagram } from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { projectReadDiagram } from "../core/projectReadDiagram";
import { ElementsSelectableProvider } from "../contexts/ElementsSelectableContext";
import { EdgeLabelPortalHost, EdgeLabelPortalProvider } from "./EdgeLabelPortal";
import EditableEdge from "./EditableEdge";
import type { EdgeData } from "./data/edgeData.types";

/**
 * The viewer draws the diagram it was handed, never the reader's own.
 *
 * `EditableEdge` reads control points and the label offset from the store's
 * active diagram. On the viewer that diagram is whatever the reader has open in
 * their workspace, so an edge the shared diagram had no waypoints for used to
 * be drawn through the reader's waypoints for the same connection id — measured
 * in docs/investigation/divergencia-edicao-visualizacao.md §3.6. The read
 * projection now stamps every edge, and a stamp always wins over the store.
 */

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

beforeEach(() => {
  useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
});

/** The reader's own workspace: a diagram with hand-drawn waypoints on one connection. */
function seedLocalDiagramWithWaypoints(): string {
  const diagram = useDiagramStore.getState().addDiagram("Local", "context");
  useDiagramStore.getState().openDiagram(diagram.id);
  const a = useDiagramStore.getState().addComponent("component", "A", null, { x: 0, y: 0 });
  const b = useDiagramStore.getState().addComponent("component", "B", null, { x: 300, y: 0 });
  const connection = useDiagramStore.getState().addConnection(a.id, b.id, "uses")!;
  useDiagramStore.getState().setEdgeControlPoints(diagram.id, connection.id, [
    { id: "p1", x: 150, y: -200 },
    { id: "p2", x: 150, y: 400 },
  ]);
  useDiagramStore.getState().setEdgeLabelOffset(diagram.id, connection.id, 0.9);
  return connection.id;
}

/** The shared diagram: same connection id, no `edgeLayouts` entry for it. */
function sharedDiagram(connectionId: string): Diagram {
  const component = (id: string): Component =>
    ({ id, name: id, type: "system", description: "", parentId: null }) as unknown as Component;
  return {
    id: "shared",
    name: "Shared",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { a: component("a"), b: component("b") },
      connections: {
        [connectionId]: { id: connectionId, sourceId: "a", targetId: "b", label: "calls" },
      },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      a: { elementId: "a", x: 0, y: 0 },
      b: { elementId: "b", x: 300, y: 0 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function renderReadEdge(data: EdgeData) {
  const props = {
    id: data.connectionId,
    source: "a",
    target: "b",
    sourceX: 0,
    sourceY: 0,
    targetX: 300,
    targetY: 80,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selected: false,
    data,
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
  const path = view.container.querySelector("path.react-flow__edge-path")?.getAttribute("d");
  const label = view.getByText("calls");
  const labelBox = label.closest(".nodrag");
  const result = { path, labelDraggable: Boolean(labelBox?.className.includes("cursor-grab")) };
  view.unmount();
  return result;
}

function readEdgeData(connectionId: string): EdgeData {
  const { edges } = projectReadDiagram(sharedDiagram(connectionId));
  return edges[0]!.data as EdgeData;
}

describe("EditableEdge on the read surface", () => {
  it("draws the same route whatever the reader's active diagram holds", () => {
    const connectionId = seedLocalDiagramWithWaypoints();
    const withLocalWaypoints = renderReadEdge(readEdgeData(connectionId));

    useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
    const withEmptyStore = renderReadEdge(readEdgeData(connectionId));

    expect(withLocalWaypoints.path).toBeTruthy();
    expect(withLocalWaypoints.path).toBe(withEmptyStore.path);
    expect(withLocalWaypoints.path).not.toContain("-200");
  });

  it("does not offer to drag a label, even with a diagram active in the store", () => {
    const connectionId = seedLocalDiagramWithWaypoints();
    expect(useDiagramStore.getState().activeDiagramId).not.toBeNull();
    expect(renderReadEdge(readEdgeData(connectionId)).labelDraggable).toBe(false);
  });
});
