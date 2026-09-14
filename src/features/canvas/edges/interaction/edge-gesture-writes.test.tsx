import { act, render } from "@testing-library/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Position, ReactFlowProvider } from "@xyflow/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDiagramStore, type Point } from "@/features/diagram";
import { useControlPoints } from "./useControlPoints";
import { useEdgeLabelDrag } from "./useEdgeLabelDrag";
import { useSegmentDrag } from "./useSegmentDrag";

/**
 * A pointer gesture is one edit, so it is one store write.
 *
 * Node drag has worked this way since the gesture index landed: positions stay
 * local and the store hears about the gesture once, on drop. Edge editing still
 * wrote on every pointermove, and each diagram-store `set()` serializes the
 * whole workspace for persist and is diffed for collaboration. Measured on the
 * 400-node fixture: 80 workspace-sized serializations for one 40-move segment
 * drag.
 *
 * No `<ReactFlow>` is rendered, only the provider, so `screenToFlowPosition`
 * has no `domNode` and returns client coordinates unchanged -- the flow
 * coordinates below are the client ones. Every move carries `altKey` so
 * snapping cannot round the assertions away.
 */

const SOURCE: Point = { x: 0, y: 0 };
const TARGET: Point = { x: 300, y: 0 };

function seed() {
  const diagram = useDiagramStore.getState().addDiagram("Edge gestures", "context");
  useDiagramStore.getState().openDiagram(diagram.id);
  const a = useDiagramStore.getState().addComponent("component", "A", null, { x: 0, y: 0 });
  const b = useDiagramStore.getState().addComponent("component", "B", null, { x: 300, y: 0 });
  const connection = useDiagramStore.getState().addConnection(a.id, b.id, "uses")!;
  return { diagramId: diagram.id, connectionId: connection.id };
}

const layout = (diagramId: string, connectionId: string) =>
  useDiagramStore.getState().diagrams[diagramId].edgeLayouts[connectionId];

function pointerDownEvent(x: number, y: number) {
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    preventDefault: () => {},
    stopPropagation: () => {},
    currentTarget: {
      focus: () => {},
      setPointerCapture: () => {},
      hasPointerCapture: () => true,
      releasePointerCapture: () => {},
    },
  } as unknown as ReactPointerEvent<never>;
}

const move = (x: number, y: number) =>
  window.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y, altKey: true }));
const release = () => window.dispatchEvent(new MouseEvent("pointerup"));

/** Renders a hook inside a React Flow provider and hands back its latest result. */
function mount<T>(useHook: () => T) {
  const held: { current: T | null } = { current: null };
  function Harness() {
    held.current = useHook();
    return null;
  }
  render(
    <ReactFlowProvider>
      <Harness />
    </ReactFlowProvider>,
  );
  return () => held.current as T;
}

/** Counts diagram-store writes; every `set()` notifies subscribers exactly once. */
function countWrites() {
  let writes = 0;
  const unsubscribe = useDiagramStore.subscribe(() => {
    writes += 1;
  });
  return { count: () => writes, stop: unsubscribe };
}

beforeEach(() => {
  useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
});

describe("dragging an edge control point", () => {
  it("writes the store once, with the position the gesture ended on", () => {
    const { diagramId, connectionId } = seed();
    useDiagramStore
      .getState()
      .setEdgeControlPoints(diagramId, connectionId, [{ id: "p1", x: 10, y: 10 }]);

    const points = mount(() => useControlPoints(connectionId));
    const writes = countWrites();

    act(() => points().startPointDrag("p1", pointerDownEvent(10, 10)));
    for (let x = 40; x <= 200; x += 40) act(() => void move(x, 60));
    act(() => void release());

    writes.stop();
    expect(writes.count()).toBe(1);
    expect(layout(diagramId, connectionId).points).toEqual([{ id: "p1", x: 200, y: 60 }]);
  });

  it("shows the point where the pointer is while the gesture is live", () => {
    const { diagramId, connectionId } = seed();
    useDiagramStore
      .getState()
      .setEdgeControlPoints(diagramId, connectionId, [{ id: "p1", x: 10, y: 10 }]);

    const points = mount(() => useControlPoints(connectionId));

    act(() => points().startPointDrag("p1", pointerDownEvent(10, 10)));
    act(() => void move(120, 45));

    expect(points().points).toEqual([{ id: "p1", x: 120, y: 45 }]);
    act(() => void release());
  });
});

describe("dragging an edge segment", () => {
  it("writes the store once, with the corners the gesture ended on", () => {
    const { diagramId, connectionId } = seed();
    const segmentDrag = mount(() => useSegmentDrag(connectionId, SOURCE, TARGET, Position.Right));
    const writes = countWrites();

    const segment = segmentDrag().segments[0];
    act(() => segmentDrag().startSegmentDrag(segment, pointerDownEvent(150, 0)));
    for (let y = 20; y <= 100; y += 20) act(() => void move(150, y));
    act(() => void release());

    writes.stop();
    expect(writes.count()).toBe(1);
    expect(layout(diagramId, connectionId).points?.length).toBeGreaterThan(0);
  });
});

describe("dragging an edge label", () => {
  it("writes the store once, with the offset the gesture ended on", () => {
    const { diagramId, connectionId } = seed();
    const labelDrag = mount(() => {
      const pointsRef = useRef<readonly Point[]>([]);
      return useEdgeLabelDrag({
        connectionId,
        enabled: true,
        source: SOURCE,
        target: TARGET,
        pointsRef,
      });
    });
    const writes = countWrites();

    act(() => labelDrag().handlePointerDown(pointerDownEvent(0, 0)));
    for (const x of [60, 120, 180, 240]) {
      act(() => labelDrag().handlePointerMove(pointerDownEvent(x, 0)));
    }
    act(() => labelDrag().handlePointerUp(pointerDownEvent(240, 0)));

    writes.stop();
    expect(writes.count()).toBe(1);
    expect(layout(diagramId, connectionId).labelOffset).toBeCloseTo(0.8, 5);
  });
});
