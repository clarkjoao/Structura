import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import {
  useDiagramStore,
  useResolvedComponents,
  useResolvedNodeLayouts,
  useVisibleComponents,
  useVisibleConnections,
  type Component,
  type Connection,
  type Diagram,
} from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { FlowModeProvider } from "../flow/FlowModeContext";
import { EMPTY_FLOW_HIGHLIGHT } from "../flow/flowState";
import { useCanvasNodes } from "../nodes/useCanvasNodes";
import { useCanvasEdges } from "../edges/useCanvasEdges";
import { useCanvasConnectionDerivations } from "../edges/useCanvasConnectionDerivations";
import { resolveLabelOffset } from "../edges/resolveEditableEdgeGeometry";
import type { EdgeData } from "../edges/data/edgeData.types";
import { projectReadDiagram } from "./projectReadDiagram";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * One diagram, one picture: the editor and the viewer project it the same way.
 *
 * The two modes share the node components, `EditableEdge`, `buildData` and
 * `buildEdge`, but they reach React Flow through two projections — the
 * editor's hooks and the viewer's `projectReadDiagram` — and every rule that
 * lived on one side only was a visible difference: children of a collapsed
 * panel drawn on the viewer, components with no layout drawn at the origin,
 * a stacking order the viewer ignored. See
 * docs/investigation/divergencia-edicao-visualizacao.md §3.
 *
 * The editor side here is the chain `useCanvasGraphState` runs, fed by the
 * store's own selectors, with nothing selected. Only what the reader is meant
 * to see is compared: selection, compare mode and flow overlays are the
 * editor's and are all off.
 */

function component(partial: Record<string, unknown>): Component {
  return { description: "", parentId: null, ...partial } as unknown as Component;
}

function connection(id: string, sourceId: string, targetId: string): Connection {
  return { id, sourceId, targetId, label: id };
}

/**
 * Two panels, one collapsed; a hidden component; one with no layout; an edge
 * with waypoints and a label offset; a user stacking order on a panel.
 */
function parityDiagram(): Diagram {
  const components = [
    component({ id: "P", name: "Collapsed", type: "panel", panelKind: "default", collapsed: true }),
    component({ id: "p1", name: "p1", type: "system", parentId: "P" }),
    component({ id: "p2", name: "p2", type: "system", parentId: "P" }),
    component({ id: "Q", name: "Open", type: "panel", panelKind: "default" }),
    component({ id: "q1", name: "q1", type: "system", parentId: "Q" }),
    component({ id: "x", name: "x", type: "system" }),
    component({ id: "h", name: "h", type: "system", hidden: true }),
    component({ id: "n", name: "no layout", type: "system" }),
  ];
  const connections = [
    connection("x-p1", "x", "p1"),
    connection("p1-q1", "p1", "q1"),
    connection("q1-p2", "q1", "p2"),
    connection("x-h", "x", "h"),
    connection("x-n", "x", "n"),
    connection("x-q1", "x", "q1"),
    connection("Q-x", "Q", "x"),
  ];
  return {
    id: "parity",
    name: "Parity",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: Object.fromEntries(connections.map((c) => [c.id, c])),
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      P: { elementId: "P", x: 0, y: 0, zIndex: -1, width: 400, height: 300 },
      p1: { elementId: "p1", x: 20, y: 60 },
      p2: { elementId: "p2", x: 20, y: 160 },
      Q: { elementId: "Q", x: 600, y: 0, zIndex: 3, width: 400, height: 300 },
      q1: { elementId: "q1", x: 40, y: 80 },
      x: { elementId: "x", x: 1200, y: 100 },
      h: { elementId: "h", x: 1200, y: 400 },
    },
    edgeLayouts: {
      "x-q1": {
        points: [
          { id: "cp1", x: 1150, y: 40 },
          { id: "cp2", x: 700, y: 40 },
        ],
        labelOffset: 0.25,
      },
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

const written: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };
const NO_IDS = new Set<string>();

function WriteProjection() {
  const store = useDiagramStore();
  const diagram = store.diagrams[store.activeDiagramId!] as Diagram;
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const resolvedComponents = useResolvedComponents();
  const resolvedNodeLayouts = useResolvedNodeLayouts();
  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, resolvedComponents });
  written.nodes = useCanvasNodes({
    diagram,
    diagramSceneState: null,
    flows: [],
    resolvedComponents,
    resolvedNodeLayouts,
    sceneBadgeByComponentId: {},
    visibleComponents,
    panelIds,
    selectedNodeId: null,
    selectedNodeIds: NO_IDS,
    highlightedNodeIds: NO_IDS,
    serviceCatalog: {},
    allDiagrams: store.diagrams as Record<string, Diagram>,
    handleDrillDown: () => {},
    handlePanelCollapseToggle: () => {},
    isPlaying: false,
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
    connectionCountPerNode,
    effectiveHandleOrder,
    flowHighlight: EMPTY_FLOW_HIGHLIGHT,
    activeStep: null,
    flowBadges: null,
    coverage: null,
    isViewingCoverage: false,
    isNodeHiddenByTagFilter: () => false,
    updateComponent: () => {},
  });
  written.edges = useCanvasEdges({
    diagram,
    visibleConnections,
    edgeHandleAssignments,
    selectedEdgeId: null,
    isPlaying: false,
    activeStep: null,
    flowHighlight: EMPTY_FLOW_HIGHLIGHT,
    flowBadges: null,
    coverage: null,
    visibleTags: null,
    visibleTagsKey: null,
  });
  return null;
}

function writeProjection(diagram: Diagram) {
  useDiagramStore.setState({ diagrams: { [diagram.id]: diagram }, activeDiagramId: diagram.id });
  render(
    <FlowModeProvider>
      <WriteProjection />
    </FlowModeProvider>,
  );
  return written;
}

/** What the reader sees of a node: where, how big, nested in what, and whether at all. */
function nodeShape(node: Node) {
  const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
  const data = node.data as { incomingCount?: unknown; outgoingCount?: unknown };
  return {
    position: node.position,
    parentId: node.parentId,
    extent: node.extent,
    hidden: Boolean(node.hidden),
    width: style.width,
    height: style.height,
    incomingCount: data.incomingCount,
    outgoingCount: data.outgoingCount,
  };
}

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/**
 * The route and label placement `EditableEdge` will draw. The editor's comes
 * from the store's active diagram — here, the same diagram — and the reader's
 * from the stamp on the edge.
 */
function writeGeometry(diagram: Diagram, edge: Edge) {
  const data = edge.data as EdgeData;
  const stored = diagram.edgeLayouts[edge.id];
  return {
    points: stored?.points ?? [],
    labelOffset: resolveLabelOffset({
      layoutLabelOffset: data.layoutLabelOffset,
      storeLabelOffset: stored?.labelOffset,
      legacyLabelPosition: data.labelPosition,
    }),
  };
}

function readGeometry(edge: Edge) {
  const data = edge.data as EdgeData;
  return {
    points: data.layoutPoints,
    labelOffset: resolveLabelOffset({
      layoutLabelOffset: data.layoutLabelOffset,
      storeLabelOffset: undefined,
      legacyLabelPosition: data.labelPosition,
    }),
  };
}

describe("editor and viewer project one diagram the same way", () => {
  beforeEach(() => {
    useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
    useCanvasSelectionStore.getState().clearSelection();
  });

  it("puts the same nodes on the canvas, in the same places, hidden the same way", () => {
    const diagram = parityDiagram();
    const write = writeProjection(diagram);
    const read = projectReadDiagram(diagram);

    expect(read.nodes.map((n) => n.id).sort()).toEqual(write.nodes.map((n) => n.id).sort());
    const writeNodes = byId(write.nodes);
    for (const node of read.nodes) {
      expect({ id: node.id, ...nodeShape(node) }).toEqual({
        id: node.id,
        ...nodeShape(writeNodes[node.id]!),
      });
    }
  });

  it("hides a collapsed panel's children and never draws a component with no layout", () => {
    // The assertions above could pass on two projections that are wrong the
    // same way; these pin what "the same" has to mean.
    const read = byId(projectReadDiagram(parityDiagram()).nodes);
    expect(read.p1?.hidden).toBe(true);
    expect(read.p2?.hidden).toBe(true);
    expect(read.q1?.hidden).toBe(false);
    expect(read.h?.hidden).toBe(true);
    expect(read.n).toBeUndefined();
  });

  it("builds the same edges, on the same handles, along the same route", () => {
    const diagram = parityDiagram();
    const write = writeProjection(diagram);
    const read = projectReadDiagram(diagram);

    expect(read.edges.map((e) => e.id).sort()).toEqual(write.edges.map((e) => e.id).sort());
    const writeEdges = byId(write.edges);
    for (const edge of read.edges) {
      const counterpart = writeEdges[edge.id]!;
      expect({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        ...readGeometry(edge),
      }).toEqual({
        id: counterpart.id,
        source: counterpart.source,
        target: counterpart.target,
        sourceHandle: counterpart.sourceHandle,
        targetHandle: counterpart.targetHandle,
        ...writeGeometry(diagram, counterpart),
      });
    }
  });

  it("drops an edge to a hidden or unplaced component on both sides", () => {
    const edgeIds = projectReadDiagram(parityDiagram()).edges.map((e) => e.id);
    expect(edgeIds).not.toContain("x-h");
    expect(edgeIds).not.toContain("x-n");
    expect(edgeIds).toContain("x-q1");
  });
});
