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
  type CompareElementVisual,
  type Diagram,
  type VersionDiff,
} from "@/features/diagram";
import { domainColor } from "@/features/diagram/model/boundary";
import { LEGEND_NODE_ID, LEGEND_NODE_TYPE } from "./legendNode";
import { useLLMStore, type PendingNodePreview } from "@/features/llm";
import "@/features/canvas/nodes/node-types/registry";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { FlowModeProvider } from "../flow/FlowModeContext";
import { EMPTY_FLOW_HIGHLIGHT } from "../flow/flowState";
import { useCanvasNodes } from "../nodes/useCanvasNodes";
import { useCanvasEdges } from "../edges/useCanvasEdges";
import { useCanvasConnectionDerivations } from "../edges/useCanvasConnectionDerivations";
import { resolveLabelOffset } from "../edges/resolveEditableEdgeGeometry";
import { resolveNodeDescriptor } from "../nodes/node-types";
import type { EdgeData } from "../edges/data/edgeData.types";
import { SEED_DIAGRAMS } from "@/fixtures/seeds";
import { arrangePreviewDiagram } from "@/embed/arrange";
import { buildPreviewDiagram } from "@/embed/build-diagram";
import { projectReadDiagram } from "./projectReadDiagram";
import { resolveViewSnapshot } from "./resolveViewSnapshot";

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
 * a stacking order the viewer ignored.
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
      // Laid out taller than a bare card's content, as ELK's boxes come back.
      x: { elementId: "x", x: 1200, y: 100, width: 260, height: 180 },
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

/**
 * What only the editor has, off by default. The slice-5 block below turns all
 * of it on and checks the base the editor draws does not move.
 */
interface EditorModes {
  selectedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  isCompareMode: boolean;
  compareVisualByComponentId: Record<string, CompareElementVisual> | undefined;
  compareConnectionOpacity: Record<string, number> | undefined;
  hiddenByTag: (component: Component) => boolean;
}
const EDITOR_MODES_OFF: EditorModes = {
  selectedNodeIds: NO_IDS,
  highlightedNodeIds: NO_IDS,
  selectedEdgeId: null,
  isCompareMode: false,
  compareVisualByComponentId: undefined,
  compareConnectionOpacity: undefined,
  hiddenByTag: () => false,
};
let editorModes: EditorModes = EDITOR_MODES_OFF;

function WriteProjection() {
  const store = useDiagramStore();
  const diagram = store.diagrams[store.activeDiagramId!] as Diagram;
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const resolvedComponents = useResolvedComponents();
  const resolvedNodeLayouts = useResolvedNodeLayouts();
  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, resolvedComponents });
  // As useCanvasGraphState builds it: the diagram's own versions.
  const view = resolveViewSnapshot(
    diagram,
    {
      versionId: diagram.activeVersionId ?? null,
      compareVersionId: diagram.compareVersionId ?? null,
    },
    resolveNodeDescriptor,
  );
  written.nodes = useCanvasNodes({
    diagram,
    diagramVersionState: null,
    flows: [],
    resolvedComponents,
    resolvedNodeLayouts,
    versionBadgeByComponentId: {},
    view,
    panelIds,
    selectedNodeId: [...editorModes.selectedNodeIds][0] ?? null,
    selectedNodeIds: editorModes.selectedNodeIds,
    highlightedNodeIds: editorModes.highlightedNodeIds,
    isCompareMode: editorModes.isCompareMode,
    compareVisualByComponentId: editorModes.compareVisualByComponentId,
    services: {},
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
    isNodeHiddenByTagFilter: editorModes.hiddenByTag,
    updateComponent: () => {},
  });
  written.edges = useCanvasEdges({
    diagram,
    view,
    edgeHandleAssignments,
    selectedEdgeId: editorModes.selectedEdgeId,
    isCompareMode: editorModes.isCompareMode,
    compareConnectionOpacity: editorModes.compareConnectionOpacity,
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

/** What the reader sees of a node: where, how big, how stacked, nested in what, and whether at all. */
function nodeShape(node: Node) {
  const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
  const data = node.data as {
    incomingCount?: unknown;
    outgoingCount?: unknown;
    laidOutMinHeight?: unknown;
  };
  return {
    position: node.position,
    zIndex: node.zIndex,
    parentId: node.parentId,
    extent: node.extent,
    hidden: Boolean(node.hidden),
    width: style.width,
    height: style.height,
    // A card is content-sized; the height it declares is its floor (RT-041).
    laidOutMinHeight: data.laidOutMinHeight,
    incomingCount: data.incomingCount,
    outgoingCount: data.outgoingCount,
  };
}

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/**
 * The route and label placement `EditableEdge` will draw at rest. Since slice 6
 * both surfaces draw it from the edge's data; the editor's must also be what
 * the diagram holds (`edgeLayouts`), which `writeGeometry` checks on the way.
 */
function writeGeometry(diagram: Diagram, edge: Edge) {
  const drawn = readGeometry(edge);
  const stored = diagram.edgeLayouts[edge.id];
  expect(drawn.points).toEqual(stored?.points ?? []);
  expect(drawn.labelOffset).toBe(stored?.labelOffset ?? (edge.data as EdgeData).labelPosition);
  return drawn;
}

function readGeometry(edge: Edge) {
  const data = edge.data as EdgeData;
  return {
    points: data.layoutPoints,
    labelOffset: resolveLabelOffset({
      layoutLabelOffset: data.layoutLabelOffset,
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

  it("declares the height the layout gave a card on both sides, not its content's", () => {
    // RT-041: the editor left the floor off, drew the card at its content
    // height and routed every edge off the corridor the viewer still followed.
    const diagram = parityDiagram();
    const write = byId(writeProjection(diagram).nodes);
    const read = byId(projectReadDiagram(diagram).nodes);
    expect((write.x?.data as { laidOutMinHeight?: number }).laidOutMinHeight).toBe(180);
    expect((read.x?.data as { laidOutMinHeight?: number }).laidOutMinHeight).toBe(180);
  });

  it("stacks nodes in the order the author chose", () => {
    // `Q` was brought to front in the editor (`nodeLayouts.Q.zIndex = 3`).
    const read = byId(projectReadDiagram(parityDiagram()).nodes);
    expect(read.Q?.zIndex).toBe(3);
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

  it("draws an edge's interaction the same on both sides: sync solid, async dashed", () => {
    const diagram = parityDiagram();
    diagram.snapshot.connections["x-p2"] = {
      id: "x-p2",
      sourceId: "x",
      targetId: "q1",
      label: "sync call",
      interaction: "sync",
      kind: "call",
    };
    diagram.snapshot.connections["q1-x"] = {
      id: "q1-x",
      sourceId: "q1",
      targetId: "x",
      label: "async event",
      interaction: "async",
      kind: "event",
    };
    // A saved diagram that predates the migration still draws as it did.
    diagram.snapshot.connections["legacy"] = {
      id: "legacy",
      sourceId: "x",
      targetId: "q1",
      label: "legacy dependency",
      intent: "dependency",
    };
    const write = writeProjection(diagram);
    const read = projectReadDiagram(diagram);
    const strokeOf = (edges: Edge[], id: string) =>
      (edges.find((e) => e.id === id)?.data as EdgeData | undefined)?.strokeStyle;

    expect(strokeOf(read.edges, "x-p2")).toBe("solid");
    expect(strokeOf(read.edges, "q1-x")).toBe("dashed");
    expect(strokeOf(read.edges, "legacy")).toBe("dashed");
    for (const id of ["x-p2", "q1-x", "legacy"]) {
      expect(strokeOf(write.edges, id)).toBe(strokeOf(read.edges, id));
    }
  });

  it("derives a typed boundary's colour and outline the same on both sides", () => {
    const diagram = parityDiagram();
    diagram.snapshot.components["Vendas"] = component({
      id: "Vendas",
      name: "Vendas",
      type: "panel",
      panelKind: "default",
    });
    diagram.snapshot.components["Net"] = component({
      id: "Net",
      name: "Net",
      type: "panel",
      panelKind: "default",
      parentId: "Vendas",
      boundaryType: "network",
    });
    diagram.nodeLayouts["Vendas"] = { elementId: "Vendas", x: 0, y: 900, width: 600, height: 400 };
    diagram.nodeLayouts["Net"] = { elementId: "Net", x: 20, y: 40, width: 300, height: 200 };
    const write = writeProjection(diagram);
    const read = projectReadDiagram(diagram);
    const look = (nodes: Node[]) => {
      const data = nodes.find((n) => n.id === "Net")?.data as
        { panelColor?: string; borderStyle?: string } | undefined;
      return { color: data?.panelColor, border: data?.borderStyle };
    };
    expect(look(read.nodes)).toEqual({ color: domainColor("Vendas"), border: "dashed" });
    expect(look(write.nodes)).toEqual(look(read.nodes));
  });

  it("draws the generated legend, under the diagram, the same on both sides", () => {
    const diagram = parityDiagram();
    diagram.showLegend = true;
    diagram.snapshot.components["Vendas"] = component({
      id: "Vendas",
      name: "Vendas",
      type: "panel",
      panelKind: "default",
    });
    diagram.snapshot.components["Net"] = component({
      id: "Net",
      name: "Net",
      type: "panel",
      panelKind: "default",
      parentId: "Vendas",
      boundaryType: "network",
    });
    diagram.nodeLayouts["Vendas"] = { elementId: "Vendas", x: 0, y: 900, width: 600, height: 400 };
    diagram.nodeLayouts["Net"] = { elementId: "Net", x: 20, y: 40, width: 300, height: 200 };
    diagram.snapshot.connections["x-p2"] = {
      id: "x-p2",
      sourceId: "x",
      targetId: "q1",
      label: "async",
      interaction: "async",
    };
    const write = writeProjection(diagram);
    const read = projectReadDiagram(diagram);
    const legendOf = (nodes: Node[]) => nodes.find((n) => n.id === LEGEND_NODE_ID);

    const readLegend = legendOf(read.nodes);
    expect(readLegend).toBeDefined();
    expect(readLegend?.type).toBe(LEGEND_NODE_TYPE);
    const data = readLegend?.data as {
      legend: { boundaryTypes: unknown[]; domains: unknown[]; interactions: string[] };
    };
    expect(data.legend.boundaryTypes).toHaveLength(1);
    expect(data.legend.domains).toEqual([{ name: "Vendas", color: domainColor("Vendas") }]);
    expect(data.legend.interactions).toEqual(["sync", "async"]);
    // Under the lowest node, aligned with the leftmost.
    expect(readLegend?.position.x).toBe(0);
    expect(readLegend?.position.y).toBeGreaterThan(1300);
    // Not draggable, not selectable: its place is derived, never stored.
    expect(readLegend?.draggable).toBe(false);
    expect(readLegend?.selectable).toBe(false);

    const writeLegend = legendOf(write.nodes);
    expect(writeLegend?.position).toEqual(readLegend?.position);
    expect(writeLegend?.data).toEqual(readLegend?.data);
  });

  it("draws no legend unless the diagram asks, or when it has nothing to say", () => {
    const off = parityDiagram();
    expect(projectReadDiagram(off).nodes.some((n) => n.id === LEGEND_NODE_ID)).toBe(false);
    const on = parityDiagram();
    on.showLegend = true;
    // Plain connections are synchronous: that alone is something to say.
    expect(projectReadDiagram(on).nodes.some((n) => n.id === LEGEND_NODE_ID)).toBe(true);
    const bare = parityDiagram();
    bare.showLegend = true;
    bare.snapshot.connections = {};
    expect(projectReadDiagram(bare).nodes.some((n) => n.id === LEGEND_NODE_ID)).toBe(false);
  });

  it("drops an edge to a hidden or unplaced component on both sides", () => {
    const edgeIds = projectReadDiagram(parityDiagram()).edges.map((e) => e.id);
    expect(edgeIds).not.toContain("x-h");
    expect(edgeIds).not.toContain("x-n");
    expect(edgeIds).toContain("x-q1");
  });
});

/*
 * Slice 4: one view rule (`resolveViewSnapshot`) for both surfaces.
 *
 * The cases below are the ones the slice-4 discovery ran, plus a scene and a
 * comparison. For every diagram both surfaces must hand React Flow the same
 * arrays — same members, same order, same shape — not merely the same set:
 * React Flow stacks equal-z nodes in array order, so order is part of the
 * picture. Before the slice every one of the six differed in order only.
 */

type Placement = { x: number; y: number; zIndex?: number; width?: number; height?: number };

function sceneDiagram(
  components: Component[],
  layouts: Record<string, Placement>,
  connections: Connection[] = [],
  versions: Record<string, VersionDiff> = {},
): Diagram {
  return {
    id: "slice4",
    name: "Slice 4",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: Object.fromEntries(connections.map((c) => [c.id, c])),
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: Object.fromEntries(
      Object.entries(layouts).map(([id, layout]) => [id, { elementId: id, ...layout }]),
    ),
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    versions,
  };
}

const panelOf = (id: string, extra: Record<string, unknown> = {}) =>
  component({ id, name: id, type: "panel", panelKind: "default", ...extra });
const cardOf = (id: string, parentId: string | null = null, extra: Record<string, unknown> = {}) =>
  component({ id, name: id, type: "system", parentId, ...extra });
const box = (x: number, y: number, zIndex?: number): Placement => ({
  x,
  y,
  width: 400,
  height: 300,
  ...(zIndex !== undefined ? { zIndex } : {}),
});

const BASE_CASES: Record<string, Diagram> = {
  "a collapsed panel inside a collapsed panel": sceneDiagram(
    [
      panelOf("A", { collapsed: true }),
      panelOf("B", { parentId: "A", collapsed: true }),
      cardOf("b1", "B"),
      cardOf("x"),
    ],
    { A: box(0, 0, -1), B: box(20, 60, -1), b1: { x: 20, y: 60 }, x: { x: 900, y: 0 } },
    [connection("x-b1", "x", "b1")],
  ),
  "an expanded panel inside a collapsed one": sceneDiagram(
    [
      panelOf("A", { collapsed: true }),
      panelOf("B", { parentId: "A" }),
      cardOf("b1", "B"),
      cardOf("x"),
    ],
    { A: box(0, 0, -1), B: box(20, 60, -1), b1: { x: 20, y: 60 }, x: { x: 900, y: 0 } },
    [connection("x-b1", "x", "b1")],
  ),
  "a hidden panel with children": sceneDiagram(
    [panelOf("H", { hidden: true }), cardOf("h1", "H"), cardOf("x")],
    { H: box(0, 0, -1), h1: { x: 20, y: 60 }, x: { x: 900, y: 0 } },
    [connection("x-h1", "x", "h1")],
  ),
  "the child of a panel with no layout": sceneDiagram(
    [panelOf("U"), cardOf("u1", "U"), cardOf("x")],
    { u1: { x: 20, y: 60 }, x: { x: 900, y: 0 } },
    [connection("x-u1", "x", "u1")],
  ),
  "a stacking order set by hand": sceneDiagram([panelOf("P"), cardOf("p1", "P"), cardOf("x")], {
    P: box(0, 0, 4),
    p1: { x: 20, y: 60, zIndex: 9 },
    x: { x: 900, y: 0, zIndex: -3 },
  }),
  // What "group into panel" leaves behind: the panel is appended after the
  // children it was made from. Topological order put P2 under P1's child...
  "children listed before their panels, two panels overlapping": sceneDiagram(
    [cardOf("c2", "P2"), cardOf("c1", "P1"), panelOf("P1"), panelOf("P2")],
    { P1: box(0, 0, -1), P2: box(100, 50, -1), c1: { x: 20, y: 60 }, c2: { x: 20, y: 60 } },
  ),
};

const scene = (
  id: string,
  diff: Partial<Omit<VersionDiff, "id" | "name" | "color" | "createdAt">>,
): VersionDiff => ({
  id,
  name: id,
  color: "#000",
  createdAt: 0,
  addedComponents: {},
  addedConnections: {},
  removedComponentIds: [],
  removedConnectionIds: [],
  nodeLayouts: {},
  ...diff,
});

/** Scene `s1` moves x and removes y; `s2` adds z. Base: P holds p1, x and y are roots. */
function versionedDiagram(
  activeVersionId: string | null,
  compareVersionId: string | null,
): Diagram {
  return {
    ...sceneDiagram(
      [panelOf("P"), cardOf("p1", "P"), cardOf("x"), cardOf("y")],
      { P: box(0, 0, -1), p1: { x: 20, y: 60 }, x: { x: 900, y: 0 }, y: { x: 900, y: 300 } },
      [connection("x-p1", "x", "p1"), connection("y-x", "y", "x")],
      {
        s1: scene("s1", {
          nodeLayouts: { x: { elementId: "x", x: 600, y: 500, zIndex: 2 } },
          removedComponentIds: ["y"],
          removedConnectionIds: ["y-x"],
        }),
        s2: scene("s2", {
          addedComponents: { z: cardOf("z") },
          addedConnections: { "z-x": connection("z-x", "z", "x") },
          nodeLayouts: { z: { elementId: "z", x: 1200, y: 0 } },
        }),
      },
    ),
    activeVersionId,
    compareVersionId,
  };
}

/** A node as the reader sees it, order-sensitive when mapped over an array. */
function drawnNode(node: Node) {
  const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
  return {
    id: node.id,
    position: node.position,
    zIndex: node.zIndex,
    parentId: node.parentId,
    hidden: Boolean(node.hidden),
    width: style.width,
    height: style.height,
  };
}

function drawnEdge(edge: Edge) {
  return `${edge.id} ${edge.source}->${edge.target} ${edge.sourceHandle}->${edge.targetHandle}`;
}

describe("slice 4: editor and viewer hand React Flow the same arrays", () => {
  beforeEach(() => {
    useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
    useCanvasSelectionStore.getState().clearSelection();
  });

  for (const [name, diagram] of Object.entries(BASE_CASES)) {
    it(`${name}: same nodes, same order, same edges`, () => {
      const write = writeProjection(diagram);
      const read = projectReadDiagram(diagram);

      expect(read.nodes.map(drawnNode)).toEqual(write.nodes.map(drawnNode));
      expect(read.edges.map(drawnEdge)).toEqual(write.edges.map(drawnEdge));
      expect(read.edges.map(readGeometry)).toEqual(
        write.edges.map((edge) => writeGeometry(diagram, edge)),
      );
    });
  }

  it("stacks overlapping equal-z panels the way the editor does", () => {
    // The visible change this slice makes, on purpose: P2 was drawn under P1
    // in a shared link and over it in the editor.
    const order = projectReadDiagram(
      BASE_CASES["children listed before their panels, two panels overlapping"]!,
    ).nodes.map((node) => node.id);
    expect(order).toEqual(["P1", "P2", "c2", "c1"]);
  });

  const SCENE_CASES: Record<string, [string | null, string | null]> = {
    "an active scene that moves one node and removes another": ["s1", null],
    "two scenes compared": ["s1", "s2"],
  };

  for (const [name, [versionId, compareVersionId]] of Object.entries(SCENE_CASES)) {
    it(`${name}: the editor draws what resolveViewSnapshot resolves for its scenes`, () => {
      const diagram = versionedDiagram(versionId, compareVersionId);
      const write = writeProjection(diagram);
      const view = resolveViewSnapshot(
        diagram,
        { versionId, compareVersionId },
        resolveNodeDescriptor,
      );

      expect(
        write.nodes.map((node) => ({
          id: node.id,
          position: node.position,
          zIndex: node.zIndex,
          parentId: node.parentId,
          hidden: Boolean(node.hidden),
        })),
      ).toEqual(
        view.nodes.map((node) => ({
          id: node.component.id,
          position: { x: node.layout?.x ?? 0, y: node.layout?.y ?? 0 },
          zIndex: node.zIndex,
          parentId: node.isChild ? node.component.parentId! : undefined,
          hidden: node.isHidden,
        })),
      );
      expect(write.edges.map((edge) => edge.id)).toEqual(
        view.shownConnections.map((connection) => connection.id),
      );
    });
  }

  it("the scene cases differ from the base, so the assertions above mean something", () => {
    const base = resolveViewSnapshot(
      versionedDiagram(null, null),
      { versionId: null },
      resolveNodeDescriptor,
    );
    const inScene = resolveViewSnapshot(
      versionedDiagram("s1", null),
      { versionId: "s1" },
      resolveNodeDescriptor,
    );
    const compared = resolveViewSnapshot(
      versionedDiagram("s1", "s2"),
      { versionId: "s1", compareVersionId: "s2" },
      resolveNodeDescriptor,
    );
    const ids = (view: typeof base) => view.nodes.map((node) => node.component.id);
    expect(ids(base)).toEqual(["P", "x", "y", "p1"]);
    expect(ids(inScene)).toEqual(["P", "x", "p1"]);
    expect(inScene.nodes.find((node) => node.component.id === "x")?.zIndex).toBe(2);
    expect(ids(compared)).toEqual(expect.arrayContaining(["z", "x", "p1", "P"]));
  });

  it("a link shows the scene the author has open, drawn exactly as the editor draws it", () => {
    // An author in scene s1 shares a link, and the reader sees what the editor
    // shows — the scene, not the base underneath it.
    const read = projectReadDiagram(versionedDiagram("s1", null));
    const writeScene = writeProjection(versionedDiagram("s1", null));
    expect(read.nodes.map(drawnNode)).toEqual(writeScene.nodes.map(drawnNode));
    expect(read.edges.map(drawnEdge)).toEqual(writeScene.edges.map(drawnEdge));
    // And the scene is not the base, or the assertions above would prove nothing.
    const base = projectReadDiagram(versionedDiagram(null, null));
    expect(read.nodes.map(drawnNode)).not.toEqual(base.nodes.map(drawnNode));
  });
});

/*
 * Slice 5: what only the editor has is an overlay, and an overlay cannot move
 * the base. With every editor-only mode on at once — a selection, a highlight,
 * a selected edge, scene comparison on every node and edge, the tag filter and
 * pending LLM previews — the editor still draws the same base as the viewer:
 * same nodes in the same order, same places, stacking, nesting, visibility and
 * size, same edges on the same handles along the same route.
 */
describe("slice 5: editor-only modes leave the base alone", () => {
  beforeEach(() => {
    useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
    useCanvasSelectionStore.getState().clearSelection();
    editorModes = EDITOR_MODES_OFF;
    useLLMStore.setState({ pendingPreviews: [] });
  });

  for (const [name, diagram] of Object.entries(BASE_CASES)) {
    it(`${name}: every overlay on, same base as the viewer`, () => {
      const read = projectReadDiagram(diagram);
      const nodeIds = read.nodes.map((node) => node.id);
      const edgeIds = read.edges.map((edge) => edge.id);
      editorModes = {
        selectedNodeIds: new Set(nodeIds.slice(0, 1)),
        highlightedNodeIds: new Set(nodeIds.slice(1, 2)),
        selectedEdgeId: edgeIds[0] ?? null,
        isCompareMode: true,
        compareVisualByComponentId: Object.fromEntries(
          nodeIds.map((id) => [id, { opacity: 0.5, badgeA: { name: "A", color: "#f00" } }]),
        ) as Record<string, CompareElementVisual>,
        compareConnectionOpacity: Object.fromEntries(edgeIds.map((id) => [id, 0.5])),
        hiddenByTag: (component) => component.id === nodeIds[nodeIds.length - 1],
      };
      useLLMStore.setState({
        pendingPreviews: [{ suggestionId: "s", nodeIds, edgeIds } as unknown as PendingNodePreview],
      });

      const write = writeProjection(diagram);

      // The overlays did act, so the equalities below are not vacuous.
      expect(write.nodes.some((node) => node.className?.includes("node-pending"))).toBe(true);
      expect(write.nodes.every((node) => node.draggable === false)).toBe(true);
      if (edgeIds.length > 0) {
        expect(write.edges.some((edge) => edge.selected)).toBe(true);
        expect(write.edges.every((edge) => edge.className?.includes("edge-pending"))).toBe(true);
      }

      expect(write.nodes.map(drawnNode)).toEqual(read.nodes.map(drawnNode));
      expect(write.edges.map(drawnEdge)).toEqual(read.edges.map(drawnEdge));
      expect(write.edges.map((edge) => writeGeometry(diagram, edge))).toEqual(
        read.edges.map(readGeometry),
      );
    });
  }
});

/*
 * RT-016: what is visible, nested and stacked is the same on every surface.
 *
 * Regressions this block locks (see the commit body for the full list):
 *  - dd17f47c "hide what the editor hides — collapsed children, unplaced nodes"
 *  - dd17f47c "honour the stacking order the author set"
 *  - dd17f47c "stamp every edge so the reader's store never draws it"
 *  - fbff9f70 / dd17f47c "open a shared link on the scene the author has open"
 * The embed has no projection of its own: `EmbedPreview` hands the diagram it
 * built (and, in automatic mode, arranged) to `ViewerCanvas`, so it is held to
 * the same editor-vs-reader comparison on the diagram it would draw.
 */

/** The visible picture, reduced to what a reader can tell apart. */
function visiblePicture(nodes: Node[], edges: Edge[]) {
  const shown = nodes.filter((node) => !node.hidden);
  return {
    nodeIds: shown.map((node) => node.id),
    parents: Object.fromEntries(shown.map((node) => [node.id, node.parentId ?? null])),
    stacking: Object.fromEntries(shown.map((node) => [node.id, node.zIndex])),
    edgeIds: edges.map((edge) => edge.id),
  };
}

/** Collapsed panels, an active scene that re-stacks and removes, and a custom z-order, at once. */
function combinedDiagram(): Diagram {
  const base = sceneDiagram(
    [
      panelOf("C", { collapsed: true }),
      cardOf("c1", "C"),
      cardOf("c2", "C"),
      panelOf("O"),
      cardOf("o1", "O"),
      cardOf("x"),
      cardOf("gone"),
    ],
    {
      C: box(0, 0, -1),
      c1: { x: 20, y: 60 },
      c2: { x: 20, y: 160 },
      O: box(600, 0, 5),
      o1: { x: 40, y: 80, zIndex: 8 },
      x: { x: 1200, y: 100, zIndex: -2 },
      gone: { x: 1200, y: 400 },
    },
    [
      connection("x-c1", "x", "c1"),
      connection("x-o1", "x", "o1"),
      connection("c2-o1", "c2", "o1"),
      connection("x-gone", "x", "gone"),
    ],
    {
      s1: scene("s1", {
        nodeLayouts: { x: { elementId: "x", x: 1300, y: 150, zIndex: 11 } },
        removedComponentIds: ["gone"],
        removedConnectionIds: ["x-gone"],
      }),
    },
  );
  return { ...base, activeVersionId: "s1", compareVersionId: null };
}

describe("RT-016: editor and viewer agree on what is visible, nested and stacked", () => {
  beforeEach(() => {
    useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
    useCanvasSelectionStore.getState().clearSelection();
    editorModes = EDITOR_MODES_OFF;
  });

  it("collapsed panels + active scene + custom z-order: same visible ids, parents and stacking", () => {
    const diagram = combinedDiagram();
    const write = writeProjection(diagram);
    const read = projectReadDiagram(diagram);

    expect(visiblePicture(read.nodes, read.edges)).toEqual(
      visiblePicture(write.nodes, write.edges),
    );
    expect(read.nodes.map(drawnNode)).toEqual(write.nodes.map(drawnNode));
    expect(read.edges.map(drawnEdge)).toEqual(write.edges.map(drawnEdge));

    // Pinned, so "the same" cannot mean "wrongly the same" (dd17f47c).
    const picture = visiblePicture(read.nodes, read.edges);
    expect(picture.nodeIds).not.toContain("c1"); // collapsed panel's children
    expect(picture.nodeIds).not.toContain("c2");
    expect(picture.nodeIds).not.toContain("gone"); // removed by the open scene
    expect(picture.stacking["O"]).toBe(5); // z-order the author set
    expect(picture.stacking["o1"]).toBe(8);
    expect(picture.stacking["x"]).toBe(11); // the scene's z, not the base's -2
    expect(picture.parents["o1"]).toBe("O");
    expect(picture.edgeIds).not.toContain("x-gone"); // its end was removed by the scene
    expect(picture.edgeIds).toContain("x-o1");
  });

  describe("every seed diagram", () => {
    for (const [id, diagram] of Object.entries(SEED_DIAGRAMS)) {
      it(`${id}: same visible nodes, edges, parents and stacking`, () => {
        const write = writeProjection(diagram);
        const read = projectReadDiagram(diagram);

        expect(visiblePicture(read.nodes, read.edges)).toEqual(
          visiblePicture(write.nodes, write.edges),
        );
        expect(read.nodes.map(drawnNode)).toEqual(write.nodes.map(drawnNode));
        expect(read.edges.map(drawnEdge)).toEqual(write.edges.map(drawnEdge));
      });
    }

    it("the seeds exercise nesting and stacking, so the comparison above is not vacuous", () => {
      const reads = Object.values(SEED_DIAGRAMS).map((d) => projectReadDiagram(d));
      expect(reads.some((r) => r.nodes.some((n) => n.parentId))).toBe(true);
      expect(reads.every((r) => r.nodes.length > 0)).toBe(true);
      expect(reads.some((r) => r.edges.length > 0)).toBe(true);
    });
  });

  describe("the embed's diagram", () => {
    const graph = {
      components: [
        { key: "P", name: "Panel", type: "panel", x: 0, y: 0 },
        { key: "a", name: "a", type: "system", x: 20, y: 60, parentKey: "P" },
        { key: "b", name: "b", type: "system", x: 900, y: 0 },
      ],
      connections: [{ source: "b", target: "a", label: "calls" }],
    };

    it("as the host placed it: editor and viewer draw the same picture", () => {
      const diagram = buildPreviewDiagram(graph as never);
      const write = writeProjection(diagram);
      const read = projectReadDiagram(diagram);
      expect(visiblePicture(read.nodes, read.edges)).toEqual(
        visiblePicture(write.nodes, write.edges),
      );
      expect(visiblePicture(read.nodes, read.edges).parents["a"]).toBe("P");
    });

    it("arranged here (arrange: automatic): editor and viewer draw the same picture", async () => {
      const arranged = await arrangePreviewDiagram(buildPreviewDiagram(graph as never));
      const write = writeProjection(arranged);
      const read = projectReadDiagram(arranged);
      expect(visiblePicture(read.nodes, read.edges)).toEqual(
        visiblePicture(write.nodes, write.edges),
      );
      expect(read.nodes.map(drawnNode)).toEqual(write.nodes.map(drawnNode));
    });
  });

  it("the viewer never moves what the diagram placed (dd17f47c: no ELK on ?diagramId / file)", () => {
    // The projection is pure: positions in are positions out, for every seed.
    for (const diagram of Object.values(SEED_DIAGRAMS)) {
      for (const node of projectReadDiagram(diagram).nodes) {
        const layout = diagram.nodeLayouts[node.id];
        if (!layout) continue;
        expect(node.position).toEqual({ x: layout.x, y: layout.y });
      }
    }
  });
});
