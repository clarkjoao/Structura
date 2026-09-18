import { act, render } from "@testing-library/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Position, ReactFlowProvider } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDiagramStore,
  useResolvedComponents,
  useVisibleComponents,
  useVisibleConnections,
  type Diagram,
  type Point,
} from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { FlowModeProvider } from "../../flow/FlowModeContext";
import { EMPTY_FLOW_HIGHLIGHT } from "../../flow/flowState";
import { resolveNodeDescriptor } from "../../nodes/node-types";
import { resolveViewSnapshot } from "../../core/resolveViewSnapshot";
import { useCanvasConnectionDerivations } from "../useCanvasConnectionDerivations";
import { useCanvasEdges } from "../useCanvasEdges";
import type { EdgeData } from "../data/edgeData.types";
import { resolveLabelOffset } from "../resolveEditableEdgeGeometry";
import { useControlPoints } from "./useControlPoints";
import { useEdgeLabelDrag } from "./useEdgeLabelDrag";
import { useSegmentDrag } from "./useSegmentDrag";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * The edge of a gesture, with the editor drawing resting geometry from edge
 * data (slice 6 of docs/investigation/divergencia-edicao-visualizacao.md).
 *
 * The gesture hooks are fed exactly as EditableEdge feeds them: the store goes
 * through the editor's chain (selectors → view → useCanvasEdges) to edge A's
 * data, and the resting points and label offset come from that data. Every
 * render is recorded. For a segment drag, a control-point drag and a label
 * drag this checks that
 *   - writes elsewhere in the diagram mid-gesture neither touch A's data nor
 *     reset the draft (a remount would drop the hook's local state), and
 *   - on release the store gets the draft, and no render after it shows the
 *     pre-gesture value again.
 *
 * No `<ReactFlow>` is rendered, only the provider, so `screenToFlowPosition`
 * returns client coordinates unchanged. Moves carry `altKey` to bypass snapping.
 */

const SOURCE: Point = { x: 0, y: 0 };
const TARGET: Point = { x: 300, y: 100 };

type Frame = {
  data: EdgeData;
  corners: Point[];
  points: { id: string; x: number; y: number }[];
  labelOffset: number | undefined;
};
const frames: Frame[] = [];
const held: {
  segment: ReturnType<typeof useSegmentDrag> | null;
  controls: ReturnType<typeof useControlPoints> | null;
  label: ReturnType<typeof useEdgeLabelDrag> | null;
} = { segment: null, controls: null, label: null };

function Probe({ edgeId }: { edgeId: string }) {
  const store = useDiagramStore();
  const diagram = store.diagrams[store.activeDiagramId!] as Diagram;
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const resolvedComponents = useResolvedComponents();
  const { edgeHandleAssignments } = useCanvasConnectionDerivations({
    visibleComponents,
    visibleConnections,
    resolvedComponents,
  });
  const view = resolveViewSnapshot(diagram, { sceneId: null }, resolveNodeDescriptor);
  const edges = useCanvasEdges({
    diagram,
    view,
    edgeHandleAssignments,
    selectedEdgeId: edgeId,
    isPlaying: false,
    activeStep: null,
    flowHighlight: EMPTY_FLOW_HIGHLIGHT,
    flowBadges: null,
    coverage: null,
    visibleTags: null,
    visibleTagsKey: null,
  });
  const data = edges.find((edge) => edge.id === edgeId)!.data as EdgeData;
  const resting = data.layoutPoints ?? [];
  const pointsRef = useRef<readonly Point[]>([]);
  held.segment = useSegmentDrag(edgeId, SOURCE, TARGET, Position.Right, resting);
  held.controls = useControlPoints(edgeId, resting);
  held.label = useEdgeLabelDrag({
    connectionId: edgeId,
    enabled: true,
    source: SOURCE,
    target: TARGET,
    pointsRef,
  });
  frames.push({
    data,
    corners: held.segment.corners,
    points: held.controls.points,
    labelOffset:
      held.label.offset ??
      resolveLabelOffset({
        layoutLabelOffset: data.layoutLabelOffset,
        legacyLabelPosition: data.labelPosition,
      }),
  });
  return null;
}

function seed() {
  const s = useDiagramStore.getState();
  const diagram = s.addDiagram("Gesture boundary", "container");
  s.openDiagram(diagram.id);
  const [a, b, c] = [0, 1, 2].map(
    (i) =>
      useDiagramStore.getState().addComponent("system", `n${i}`, null, { x: i * 300, y: 0 }).id,
  );
  const A = useDiagramStore.getState().addConnection(a!, b!, "A")!.id;
  const B = useDiagramStore.getState().addConnection(b!, c!, "B")!.id;
  // A Z: out along y = 0, down at x = 150, on along y = 100.
  useDiagramStore.getState().setEdgeControlPoints(diagram.id, A, [
    { id: "p1", x: 150, y: 0 },
    { id: "p2", x: 150, y: 100 },
  ]);
  useDiagramStore.getState().setEdgeLabelOffset(diagram.id, A, 0.3);
  render(
    <ReactFlowProvider>
      <FlowModeProvider>
        <Probe edgeId={A} />
      </FlowModeProvider>
    </ReactFlowProvider>,
  );
  return { diagramId: diagram.id, A, B, nodeC: c! };
}

function pointerEvent(x: number, y: number) {
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

/** Writes about other things in the diagram, landing mid-gesture. */
function concurrentWrites(diagramId: string, B: string, nodeC: string) {
  act(() => {
    useDiagramStore.getState().updateComponent(nodeC, { name: "renamed mid-gesture" });
    useDiagramStore.getState().updateConnection(B, { label: "B, relabelled" });
    useDiagramStore
      .getState()
      .setEdgeControlPoints(diagramId, B, [{ id: "b1", x: 450, y: 80 }], { history: true });
  });
}

const edgeLayout = (diagramId: string, id: string) =>
  useDiagramStore.getState().diagrams[diagramId]!.edgeLayouts[id]!;
const latest = () => frames[frames.length - 1]!;

beforeEach(() => {
  frames.length = 0;
  useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
});

describe("a gesture's draft against writes elsewhere, and its release", () => {
  it("segment drag: the draft survives, and release writes it with no step back", () => {
    const { diagramId, A, B, nodeC } = seed();
    const resting = latest().corners;
    const segment = held.segment!.segments.find((s) => s.x1 === s.x2)!;

    act(() => held.segment!.startSegmentDrag(segment, pointerEvent(segment.x1, 20)));
    act(() => void move(segment.x1 + 30, 20));
    act(() => void move(segment.x1 + 60, 20));
    const draft = latest().corners;
    expect(draft).not.toEqual(resting);
    const dataBefore = latest().data;

    concurrentWrites(diagramId, B, nodeC);
    expect(latest().data).toBe(dataBefore);
    expect(latest().corners).toEqual(draft);

    act(() => void move(segment.x1 + 90, 20));
    const lastDraft = latest().corners;
    const releasedAt = frames.length;
    act(() => void release());

    const stored = edgeLayout(diagramId, A).points!.map((p) => ({ x: p.x, y: p.y }));
    expect(stored).toEqual(lastDraft);
    expect(latest().corners).toEqual(stored);
    for (const frame of frames.slice(releasedAt)) expect(frame.corners).not.toEqual(resting);
  });

  it("control point drag: the draft survives, and release writes it with no step back", () => {
    const { diagramId, A, B, nodeC } = seed();
    const resting = latest().points;

    act(() => held.controls!.startPointDrag("p1", pointerEvent(150, 0) as never));
    act(() => void move(170, 30));
    const draft = latest().points;
    expect(draft).toEqual([
      { id: "p1", x: 170, y: 30 },
      { id: "p2", x: 150, y: 100 },
    ]);
    const dataBefore = latest().data;

    concurrentWrites(diagramId, B, nodeC);
    expect(latest().data).toBe(dataBefore);
    expect(latest().points).toEqual(draft);

    act(() => void move(190, 110));
    const releasedAt = frames.length;
    act(() => void release());

    const written = [
      { id: "p1", x: 190, y: 110 },
      { id: "p2", x: 150, y: 100 },
    ];
    expect(edgeLayout(diagramId, A).points).toEqual(written);
    expect(latest().points).toEqual(written);
    for (const frame of frames.slice(releasedAt)) expect(frame.points).not.toEqual(resting);
  });

  it("label drag: the draft survives, and release writes it with no step back", () => {
    const { diagramId, A, B, nodeC } = seed();
    expect(latest().labelOffset).toBeCloseTo(0.3, 5);

    act(() => held.label!.handlePointerDown(pointerEvent(0, 0) as never));
    // Points on the source→target line (the label's path here, no waypoints).
    act(() => held.label!.handlePointerMove(pointerEvent(150, 50) as never));
    const draft = latest().labelOffset!;
    expect(draft).toBeCloseTo(0.5, 5);
    const dataBefore = latest().data;

    concurrentWrites(diagramId, B, nodeC);
    expect(latest().data).toBe(dataBefore);
    expect(latest().labelOffset).toBe(draft);

    act(() => held.label!.handlePointerMove(pointerEvent(240, 80) as never));
    const releasedAt = frames.length;
    act(() => held.label!.handlePointerUp(pointerEvent(240, 80) as never));

    expect(edgeLayout(diagramId, A).labelOffset).toBeCloseTo(0.8, 5);
    expect(latest().labelOffset).toBeCloseTo(0.8, 5);
    for (const frame of frames.slice(releasedAt)) expect(frame.labelOffset).not.toBeCloseTo(0.3, 5);
  });
});
