import { afterEach, describe, expect, it, vi } from "vitest";
import { Position } from "@xyflow/react";
import { layout } from "./layoutEngine";
import { fromDiagram, resizableIds } from "./fromDiagram";
import { interiorWaypoints, toAppliedLayouts } from "./applyLayout";
import { measurePolylines, type ReadabilityBox } from "./layoutReadability";
import { handleAnchor, stepPolyline } from "./renderedEdgePath";
import { defaultOrthogonalCorners } from "../edges/geometry/orthogonal";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
} from "../edges/connectionDerivations";
import { MAX_HANDLES } from "../canvas.constants";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { buildGeneratedGraphInputs } from "@/features/llm/ir/apply-ir";
import { REFERENCE_DIAGRAMS, labelsOf } from "./reference-diagrams";
import { handPlacedDiagram } from "./hand-placed-diagram";
import type { LayoutGraph, LayoutResult } from "./contract";
import type { Component, Connection, NodeLayout } from "@/features/diagram";

/**
 * The toolbar Auto Layout path, measured end to end.
 *
 * `layoutReadability.baseline.test.ts` measures the LLM route
 * (`irToLayoutGraph`). This covers the other consumer: a diagram that already
 * exists in the store, driven through `fromDiagram` -> `layout` ->
 * `applyAutoLayout` with the real store actions, and counted through the real
 * `buildEdgeHandleAssignments` — so the number is what the canvas would draw,
 * not what a mirror of it would.
 *
 * Why it matters more here than on the IR route: the button always writes ELK's
 * routed waypoints as control points. With round-robin handles those control
 * points start and end nowhere near the handle the edge actually leaves from,
 * which is where most of the "before" crossings come from.
 */

type Store = ReturnType<typeof createTestDiagramStore>;

/**
 * The store mints random ids, and `layoutElkGraph` sorts its input by id — so
 * the same architecture lays out differently on every run and the crossing
 * count moves by several. Pinning the ids makes one reproducible number; the
 * random-draw test below leaves them alone, so the conclusion is checked
 * against the variation rather than against one lucky permutation.
 */
function pinIds(): void {
  let counter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    counter += 1;
    // Counter first, because `generateId` keeps only the first 16 hex chars —
    // padding at the end would collapse every id to the same string.
    const hex = counter.toString(16).padStart(16, "0") + "0".repeat(16);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as ReturnType<
      typeof crypto.randomUUID
    >;
  });
}

interface DiagramState {
  components: Record<string, Component>;
  connections: Connection[];
  nodeLayouts: Record<string, NodeLayout>;
  controlPoints: Map<string, Array<{ x: number; y: number }>>;
}

function readDiagram(store: Store, diagramId: string): DiagramState {
  const diagram = store.getState().diagrams[diagramId]!;
  const controlPoints = new Map<string, Array<{ x: number; y: number }>>();
  for (const [connectionId, edgeLayout] of Object.entries(diagram.edgeLayouts)) {
    const points = edgeLayout.points;
    if (points?.length) {
      controlPoints.set(
        connectionId,
        points.map((point) => ({ x: point.x, y: point.y })),
      );
    }
  }
  return {
    components: diagram.snapshot.components,
    connections: Object.values(diagram.snapshot.connections),
    nodeLayouts: diagram.nodeLayouts,
    controlPoints,
  };
}

/** Exactly what `useAutoLayout` does, minus React, toasts and `fitView`. */
async function pressAutoLayout(
  store: Store,
  diagramId: string,
): Promise<{ graph: LayoutGraph; result: LayoutResult }> {
  const { components, connections, nodeLayouts } = readDiagram(store, diagramId);
  const graph = fromDiagram(components, connections, nodeLayouts, {});
  const result = await layout(graph);

  store
    .getState()
    .applyAutoLayout(toAppliedLayouts(graph, result, resizableIds(graph, components)));

  for (const edge of graph.edges) {
    store.getState().resetEdgeControlPoints(diagramId, edge.id);
    const waypoints = interiorWaypoints(result.edgeRoutes.get(edge.id));
    if (waypoints.length === 0) continue;
    store.getState().setEdgeControlPoints(
      diagramId,
      edge.id,
      waypoints.map((point, index) => ({ id: `cp-${edge.id}-${index}`, x: point.x, y: point.y })),
      { history: false },
    );
  }

  return { graph, result };
}

/** The block under measurement: `useAutoLayout.ts` lines 58-66. */
function writeHandleOrder(store: Store, graph: LayoutGraph, result: LayoutResult): void {
  for (const node of graph.nodes) {
    const outgoing = result.handleOrder.outgoing.get(node.id);
    if (outgoing?.length) store.getState().updateHandleOrder(node.id, "outgoing", outgoing);
    const incoming = result.handleOrder.incoming.get(node.id);
    if (incoming?.length) store.getState().updateHandleOrder(node.id, "incoming", incoming);
  }
}

/** Absolute canvas boxes from the stored layout, sizes as the layout saw them. */
function absoluteBoxes(
  state: DiagramState,
  graph: LayoutGraph,
): { boxes: Map<string, ReadabilityBox>; parentOf: Map<string, string | null> } {
  const sizeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const boxes = new Map<string, ReadabilityBox>();
  const parentOf = new Map<string, string | null>();

  const absolute = (id: string, seen: Set<string>): { x: number; y: number } => {
    const stored = state.nodeLayouts[id];
    if (!stored || seen.has(id)) return { x: 0, y: 0 };
    seen.add(id);
    const parentId = state.components[id]?.parentId ?? null;
    if (parentId === null || state.components[parentId] === undefined) {
      return { x: stored.x, y: stored.y };
    }
    const parent = absolute(parentId, seen);
    return { x: parent.x + stored.x, y: parent.y + stored.y };
  };

  for (const node of graph.nodes) {
    const stored = state.nodeLayouts[node.id];
    if (!stored) continue;
    const position = absolute(node.id, new Set());
    const fallback = sizeById.get(node.id)!;
    boxes.set(node.id, {
      x: position.x,
      y: position.y,
      width: stored.width ?? fallback.width,
      height: stored.height ?? fallback.height,
    });
  }

  // Resolved after the box loop, so a parent written later still counts.
  for (const node of graph.nodes) {
    const parentId = state.components[node.id]?.parentId ?? null;
    parentOf.set(node.id, parentId !== null && boxes.has(parentId) ? parentId : "__root__");
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes.values()) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  boxes.set("__root__", {
    x: minX - 100,
    y: minY - 100,
    width: maxX - minX + 200,
    height: maxY - minY + 200,
  });
  parentOf.set("__root__", null);

  return { boxes, parentOf };
}

/** Handle slot count the canvas uses on a node side. */
function slotCount(count: number): number {
  return Math.min(MAX_HANDLES, Math.max(1, count));
}

function measureRendered(
  store: Store,
  diagramId: string,
  graph: LayoutGraph,
  labels: Map<string, string>,
) {
  const state = readDiagram(store, diagramId);
  const { boxes, parentOf } = absoluteBoxes(state, graph);

  const counts = buildConnectionCountPerNode(state.connections);
  const assignments = buildEdgeHandleAssignments(state.connections, counts, state.components);
  const assignmentById = new Map(assignments.map((a) => [a.connId, a] as const));

  const edges = [];
  for (const connection of state.connections) {
    const sourceBox = boxes.get(connection.sourceId);
    const targetBox = boxes.get(connection.targetId);
    const assignment = assignmentById.get(connection.id);
    if (!sourceBox || !targetBox || !assignment) continue;

    const sourceSlot = Number(/^source-(\d+)$/.exec(assignment.sourceHandle)?.[1] ?? 0);
    const targetMatch = /^target-(\d+)$/.exec(assignment.targetHandle);
    const targetSlot = Number(targetMatch?.[1] ?? 0);
    // A single-incoming node (note / db-table / json-viewer) has one handle at 50%,
    // which is what `handleAnchor` yields for count 1.
    const targetSlots =
      targetMatch === null ? 1 : slotCount(counts[connection.targetId]?.incoming ?? 1);

    const source = handleAnchor(
      sourceBox,
      "source",
      sourceSlot,
      slotCount(counts[connection.sourceId]?.outgoing ?? 1),
    );
    const target = handleAnchor(targetBox, "target", targetSlot, targetSlots);
    const stored = state.controlPoints.get(connection.id);
    const corners =
      stored && stored.length > 0
        ? stored
        : defaultOrthogonalCorners(source, target, Position.Right);

    edges.push({
      id: connection.id,
      source: connection.sourceId,
      target: connection.targetId,
      points: stepPolyline(source, target, corners),
    });
  }

  const root = boxes.get("__root__")!;
  return measurePolylines(
    { boxes, parentOf, edges, rootId: "__root__", width: root.width, height: root.height },
    { labels },
  );
}

async function seedReferenceDiagram(
  store: Store,
  name: string,
  ir: (typeof REFERENCE_DIAGRAMS)[number]["ir"],
): Promise<{ diagramId: string; labels: Map<string, string> }> {
  const diagram = store.getState().addDiagram(name, "container");
  store.getState().openDiagram(diagram.id);

  // Seeded exactly the way `applyIRToDiagram` does, minus the handleOrder and
  // waypoint writes: the diagram starts on round-robin handles.
  const { boxes } = await layout(irToLayoutGraph(ir));
  const { nodes, edges } = buildGeneratedGraphInputs(ir, boxes, { x: 0, y: 0 });
  const inserted = store.getState().insertGeneratedGraph(nodes, edges);

  const labels = new Map<string, string>();
  const irLabels = labelsOf(ir);
  ir.edges.forEach((edge, index) => {
    const connectionId = inserted.connectionIds[index];
    const text = irLabels.get(edge.id);
    if (connectionId !== undefined && text !== undefined) labels.set(connectionId, text);
  });

  return { diagramId: diagram.id, labels };
}

function seedHandPlaced(store: Store): { diagramId: string; labels: Map<string, string> } {
  const fixture = handPlacedDiagram();
  const diagram = store.getState().addDiagram(fixture.name, "container");
  store.getState().openDiagram(diagram.id);

  const idByFixtureId = new Map<string, string>();
  for (const [fixtureId, box] of fixture.boxes) {
    if (fixtureId === fixture.rootId) continue;
    const component = store
      .getState()
      .addComponent("system", fixtureId, null, { x: box.x, y: box.y });
    idByFixtureId.set(fixtureId, component.id);
    // The hand-placed boxes are 180x80; store them so `fromDiagram` sizes them
    // the same way the fixture does instead of falling back to the leaf default.
    store
      .getState()
      .updateNodeLayout(
        component.id,
        { x: box.x, y: box.y },
        { width: box.width, height: box.height },
      );
  }

  const labels = new Map<string, string>();
  for (const edge of fixture.edges) {
    const sourceId = idByFixtureId.get(edge.sourceId)!;
    const targetId = idByFixtureId.get(edge.targetId)!;
    const connection = store.getState().addConnection(sourceId, targetId, edge.label ?? "");
    if (connection && edge.label) labels.set(connection.id, edge.label);
  }

  return { diagramId: diagram.id, labels };
}

interface LayoutCase {
  name: string;
  seed: (store: Store) => Promise<{ diagramId: string; labels: Map<string, string> }>;
}

const CASES: LayoutCase[] = [
  ...REFERENCE_DIAGRAMS.map(({ name, ir }) => ({
    name,
    seed: (store: Store) => seedReferenceDiagram(store, name, ir),
  })),
  { name: "Hand-placed (out of flow)", seed: async (store: Store) => seedHandPlaced(store) },
];

interface CaseResult {
  before: number;
  after: number;
  beforeOverNode: number;
  afterOverNode: number;
  nodes: number;
  edges: number;
}

async function runCase(testCase: LayoutCase): Promise<CaseResult> {
  const store = createTestDiagramStore();
  const { diagramId, labels } = await testCase.seed(store);
  const { graph, result } = await pressAutoLayout(store, diagramId);

  const before = measureRendered(store, diagramId, graph, labels);
  writeHandleOrder(store, graph, result);
  const after = measureRendered(store, diagramId, graph, labels);

  return {
    before: before.edgeCrossings,
    after: after.edgeCrossings,
    beforeOverNode: before.edgeNodeOverlaps,
    afterOverNode: after.edgeNodeOverlaps,
    nodes: before.nodeCount,
    edges: before.edgeCount,
  };
}

describe("toolbar auto layout writes ELK's handle order", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Measured 2026-08-26, ids pinned, per diagram (crossings before -> after):
   *
   *   C4 e-commerce              7 -> 0
   *   AWS ECS Fargate           13 -> 4
   *   C4 Context healthcare     17 -> 1
   *   AWS microservices         16 -> 8
   *   Hand-placed (out of flow)  7 -> 0
   *                       total 60 -> 13
   */
  it("reduces rendered crossings on every reference diagram", async () => {
    const rows: string[] = [];
    const worsened: string[] = [];
    let totalBefore = 0;
    let totalAfter = 0;

    for (const testCase of CASES) {
      pinIds();
      const run = await runCase(testCase);
      vi.restoreAllMocks();

      totalBefore += run.before;
      totalAfter += run.after;
      if (run.after > run.before) {
        worsened.push(`${testCase.name}: ${run.before} -> ${run.after}`);
      }

      rows.push(
        [
          testCase.name.padEnd(26),
          `nodes ${String(run.nodes).padStart(3)}`,
          `edges ${String(run.edges).padStart(3)}`,
          `crossings ${String(run.before).padStart(3)} -> ${String(run.after).padStart(3)}`,
          `over-node ${String(run.beforeOverNode).padStart(3)} -> ${String(run.afterOverNode).padStart(3)}`,
        ].join("  "),
      );
    }

    console.info(
      `\nButton path rendered crossings (before -> after handleOrder), ids pinned\n` +
        `${rows.join("\n")}\nTOTAL ${totalBefore} -> ${totalAfter}\n`,
    );
    expect(worsened, worsened.join("\n")).toHaveLength(0);
    expect(totalAfter).toBeLessThan(totalBefore);
  }, 120000);

  /**
   * Real diagrams carry random ids, and `layoutElkGraph` sorts its input by id —
   * so each diagram is a draw from a distribution, not one fixed number. The
   * claim is "no draw gets worse", which needs the draws.
   */
  it("does not make any single run worse, over repeated random-id draws", async () => {
    const DRAWS = 8;
    const worsened: string[] = [];

    for (const testCase of CASES) {
      vi.restoreAllMocks();
      for (let draw = 0; draw < DRAWS; draw += 1) {
        const run = await runCase(testCase);
        if (run.after > run.before) {
          worsened.push(`${testCase.name} draw ${draw}: ${run.before} -> ${run.after}`);
        }
      }
    }

    expect(worsened, worsened.join("\n")).toHaveLength(0);
  }, 300000);

  /**
   * Control: the count has to respond to the ordering it is fed, or "0
   * crossings" would say nothing. Feeding the reverse of ELK's order through the
   * same store action must move it.
   */
  it("responds to the ordering it is fed", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      pinIds();
      const store = createTestDiagramStore();
      const { diagramId, labels } = await seedReferenceDiagram(store, name, ir);
      const { graph, result } = await pressAutoLayout(store, diagramId);

      writeHandleOrder(store, graph, result);
      const elkOrder = measureRendered(store, diagramId, graph, labels).edgeCrossings;

      for (const node of graph.nodes) {
        const outgoing = result.handleOrder.outgoing.get(node.id);
        if (outgoing?.length) {
          store.getState().updateHandleOrder(node.id, "outgoing", [...outgoing].reverse());
        }
        const incoming = result.handleOrder.incoming.get(node.id);
        if (incoming?.length) {
          store.getState().updateHandleOrder(node.id, "incoming", [...incoming].reverse());
        }
      }
      const reversed = measureRendered(store, diagramId, graph, labels).edgeCrossings;
      vi.restoreAllMocks();

      expect(reversed, `${name}: reversing the order changed nothing`).toBeGreaterThan(elkOrder);
    }
  }, 120000);
});
