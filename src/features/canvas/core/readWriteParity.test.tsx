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
  type SceneDiff,
} from "@/features/diagram";
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
  // As useCanvasGraphState builds it: the diagram's own scenes.
  const view = resolveViewSnapshot(
    diagram,
    { sceneId: diagram.activeSceneId ?? null, compareSceneId: diagram.compareSceneId ?? null },
    resolveNodeDescriptor,
  );
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
    view,
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

/** What the reader sees of a node: where, how big, how stacked, nested in what, and whether at all. */
function nodeShape(node: Node) {
  const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
  const data = node.data as { incomingCount?: unknown; outgoingCount?: unknown };
  return {
    position: node.position,
    zIndex: node.zIndex,
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
  scenes: Record<string, SceneDiff> = {},
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
    scenes,
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
  diff: Partial<Omit<SceneDiff, "id" | "name" | "color" | "createdAt">>,
): SceneDiff => ({
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
function scenedDiagram(activeSceneId: string | null, compareSceneId: string | null): Diagram {
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
    activeSceneId,
    compareSceneId,
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

  for (const [name, [sceneId, compareSceneId]] of Object.entries(SCENE_CASES)) {
    it(`${name}: the editor draws what resolveViewSnapshot resolves for its scenes`, () => {
      const diagram = scenedDiagram(sceneId, compareSceneId);
      const write = writeProjection(diagram);
      const view = resolveViewSnapshot(diagram, { sceneId, compareSceneId }, resolveNodeDescriptor);

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
      scenedDiagram(null, null),
      { sceneId: null },
      resolveNodeDescriptor,
    );
    const inScene = resolveViewSnapshot(
      scenedDiagram("s1", null),
      { sceneId: "s1" },
      resolveNodeDescriptor,
    );
    const compared = resolveViewSnapshot(
      scenedDiagram("s1", "s2"),
      { sceneId: "s1", compareSceneId: "s2" },
      resolveNodeDescriptor,
    );
    const ids = (view: typeof base) => view.nodes.map((node) => node.component.id);
    expect(ids(base)).toEqual(["P", "x", "y", "p1"]);
    expect(ids(inScene)).toEqual(["P", "x", "p1"]);
    expect(inScene.nodes.find((node) => node.component.id === "x")?.zIndex).toBe(2);
    expect(ids(compared)).toEqual(expect.arrayContaining(["z", "x", "p1", "P"]));
  });

  it("a link shows the base, and draws it exactly as the editor draws the base", () => {
    // The viewer always resolves the base: an author in scene s1 shares a link,
    // and the reader sees what the editor shows once the author leaves the scene.
    const read = projectReadDiagram(scenedDiagram("s1", null));
    const writeBase = writeProjection(scenedDiagram(null, null));
    expect(read.nodes.map(drawnNode)).toEqual(writeBase.nodes.map(drawnNode));
    expect(read.edges.map(drawnEdge)).toEqual(writeBase.edges.map(drawnEdge));
  });
});
