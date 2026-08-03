/**
 * Layout engine entry point.
 *
 * Turns a semantic description of a diagram into React Flow geometry. The caller supplies
 * intent — nodes, boundaries, connections, tiers — and never coordinates; every position
 * here is derived.
 *
 * Pipeline:
 *   P0 measureNodes       — measure node sizes
 *   P1 assignColumns      — assign tiers to columns, compute provisional x
 *   P2 orderRows         — crossing-reduction ordering within each column
 *   P3 stackRows         — convert column order to y positions
 *   P4 sizeGutters       — dimension gutters by channel demand, reflow column x
 *   P5 layoutBoundaries  — boundary boxes with cascading reflow
 *   P6 layoutCrossCutting — cross-cutting band + suppress cross-cutting edges
 *   P7 routeEdges        — orthogonal polyline waypoints + routing mode
 *   P8 snapToGrid         — snap node positions to grid, translate waypoints
 *   P9 normalizeOrigin    — translate diagram so top-left is at ORIGIN
 *   applyEdgePorts        — resolve sourceAnchor/targetAnchor from final geometry
 *
 * Aresta é polilinha: routeEdges produz os waypoints, o renderer desenha exatamente
 * eles, os validators medem exatamente eles. Uma geometria só.
 *
 * Quando o motor não consegue resolver, reporta failures e retorna `ok: false`. Nunca
 * falha silenciosamente: um layout ruim que pareceu bem é exatamente o tipo de falha
 * que este subsistema existe para eliminar.
 */

import type { Edge, Node } from "@xyflow/react";
import { densityForNodeCount, type DensityHint } from "./constants";
import { assignEdgePorts, type Rect } from "./edge-ports";
import { measureNodes, type MeasureNodeOptions, type MeasureText } from "./measure";
import { approximateMeasureText } from "./measure-text";
import { assignColumns } from "./passes/columns";
import { stackRows } from "./passes/stack-rows";
import { orderRows } from "./passes/order-rows";
import { sizeGutters } from "./passes/gutters";
import { layoutBoundaries } from "./passes/boundaries";
import { layoutCrossCutting } from "./passes/cross-cutting";
import { routeEdges } from "./passes/route-edges";
import { normalizeOrigin } from "./passes/normalize-origin";
import { snapGeometry } from "./passes/snap";
import {
  TIER_ORDER,
  cloneState,
  type LayoutBoundary,
  type LayoutConnection,
  type LayoutFailure,
  type LayoutNode,
  type LayoutState,
  type Tier,
} from "./types";

export * from "./types";
export * from "./constants";
export * from "./measure";
export * from "./measure-text";
export * from "./edge-ports";
export * from "./typography";

/** Semantic input. Deliberately geometry-free. */
export interface LayoutInput {
  nodes: Array<
    Omit<LayoutNode, "x" | "y" | "width" | "height" | "emphasis"> & {
      emphasis?: LayoutNode["emphasis"];
    }
  >;
  boundaries?: Array<Omit<LayoutBoundary, "x" | "y" | "width" | "height" | "depth">>;
  connections?: Array<
    Omit<LayoutConnection, "sourceAnchor" | "targetAnchor" | "isPrimaryPath"> & {
      isPrimaryPath?: boolean;
    }
  >;
  tiers?: readonly Tier[];
  density?: DensityHint;
  primaryPath?: string[];
}

export interface LayoutOptions {
  /** Text measurement. Browser callers pass the canvas-backed measurer. */
  measureText?: MeasureText;
  /** Descriptor `defaultSize` lookup for intrinsic-size node types. */
  defaultSizeFor?: MeasureNodeOptions["defaultSizeFor"];
  /** Content-derived size lookup for intrinsic-size node types. */
  contentSizeFor?: MeasureNodeOptions["contentSizeFor"];
}

export interface LayoutResult {
  ok: boolean;
  nodes: Node[];
  edges: Edge[];
  failures: LayoutFailure[];
  /** Final state, for validators and diagnostics. */
  state: LayoutState;
}

/** Builds initial state and runs P0 (measurement). */
function buildInitialState(input: LayoutInput, options: LayoutOptions): LayoutState {
  const measureText = options.measureText ?? approximateMeasureText;

  const sizes = measureNodes(
    input.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      technology: node.technology,
      description: node.description,
    })),
    {
      measureText,
      defaultSizeFor: options.defaultSizeFor,
      contentSizeFor: options.contentSizeFor,
    },
  );

  const primaryPath = input.primaryPath ?? [];
  const onPrimaryPath = new Set(primaryPath);

  const nodes = new Map<string, LayoutNode>();
  for (const node of input.nodes) {
    const size = sizes.get(node.id)!;
    nodes.set(node.id, {
      ...node,
      // A node on the happy path is emphasised unless the caller said otherwise.
      emphasis: node.emphasis ?? (onPrimaryPath.has(node.id) ? "primary" : "default"),
      width: size.width,
      height: size.height,
      x: 0,
      y: 0,
    });
  }

  const boundaries = new Map<string, LayoutBoundary>();
  for (const boundary of input.boundaries ?? []) {
    boundaries.set(boundary.id, { ...boundary, x: 0, y: 0, width: 0, height: 0, depth: 0 });
  }

  // Record boundary ownership on the node, so downstream consumers can map to parentId.
  for (const boundary of boundaries.values()) {
    for (const nodeId of boundary.contains) {
      const node = nodes.get(nodeId);
      if (node) node.boundaryId = boundary.id;
    }
  }

  const connections: LayoutConnection[] = (input.connections ?? []).map((connection) => ({
    ...connection,
    isPrimaryPath: connection.isPrimaryPath ?? isOnPath(connection, primaryPath),
  }));

  return {
    nodes,
    boundaries,
    connections,
    columns: [],
    tiers: input.tiers ?? TIER_ORDER,
    density: input.density ?? densityForNodeCount(input.nodes.length),
    primaryPath,
    failures: [],
    gutters: [],
    lanes: { forward: [], return: [] },
  };
}

/** Whether a connection joins two consecutive steps of the primary path. */
function isOnPath(
  connection: { from: string; to: string },
  primaryPath: readonly string[],
): boolean {
  const from = primaryPath.indexOf(connection.from);
  if (from === -1) return false;
  return primaryPath[from + 1] === connection.to;
}

/** Structural problems that make the input unlayoutable. Reported, never worked around. */
function detectFailures(state: LayoutState): LayoutFailure[] {
  const failures: LayoutFailure[] = [];

  if (state.nodes.size === 0) {
    failures.push({ code: "layout/empty", message: "No nodes to lay out." });
  }

  for (const connection of state.connections) {
    const missing: string[] = [];
    if (!state.nodes.has(connection.from)) missing.push(connection.from);
    if (!state.nodes.has(connection.to)) missing.push(connection.to);
    if (missing.length > 0) {
      failures.push({
        code: "layout/unknown-endpoint",
        message: `Connection "${connection.id}" references unknown node(s): ${missing.join(", ")}.`,
        nodeIds: missing,
      });
    }
  }

  for (const boundary of state.boundaries.values()) {
    const missing = boundary.contains.filter((id) => !state.nodes.has(id));
    if (missing.length > 0) {
      failures.push({
        code: "layout/unknown-member",
        message: `Boundary "${boundary.name}" lists unknown node(s): ${missing.join(", ")}.`,
        nodeIds: missing,
      });
    }
  }

  // A node whose tier has no column would get no position at all and silently pile up at
  // the origin, overlapping whatever else landed there. Report it instead: the caller either
  // picks a listed tier or adds it to meta.tiers.
  const known = new Set(state.tiers);
  const orphanedByTier = new Map<string, string[]>();
  for (const node of state.nodes.values()) {
    if (known.has(node.tier)) continue;
    const bucket = orphanedByTier.get(node.tier);
    if (bucket) bucket.push(node.name);
    else orphanedByTier.set(node.tier, [node.name]);
  }

  for (const [tier, names] of orphanedByTier) {
    failures.push({
      code: "layout/tier-not-in-layout",
      message:
        `${names.map((name) => `"${name}"`).join(", ")} sit in the "${tier}" tier, which is not ` +
        `one of this diagram's columns (${state.tiers.join(", ")}). Move them to a listed tier, ` +
        `or add "${tier}" to meta.tiers.`,
      nodeIds: names,
    });
  }

  return failures;
}

/** P5 — resolve edge anchors from final geometry. */
function applyEdgePorts(state: LayoutState): LayoutState {
  const next = cloneState(state);

  const rects = new Map<string, Rect>();
  for (const node of next.nodes.values()) {
    rects.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height });
  }

  const ports = assignEdgePorts(
    next.connections.map((connection) => ({
      id: connection.id,
      source: connection.from,
      target: connection.to,
      fixedSourceAnchor: connection.sourceAnchor,
      fixedTargetAnchor: connection.targetAnchor,
    })),
    rects,
  );

  for (const connection of next.connections) {
    const assigned = ports.get(connection.id);
    if (!assigned) continue;
    if (assigned.source) connection.sourceAnchor = assigned.source;
    if (assigned.target) connection.targetAnchor = assigned.target;
  }

  return next;
}

/** Runs the full pipeline. Pure and headless. */
export function layoutDiagram(input: LayoutInput, options: LayoutOptions = {}): LayoutResult {
  const initial = buildInitialState(input, options);

  const failures = detectFailures(initial);
  if (failures.length > 0) {
    // Stop rather than lay out a diagram we know is wrong.
    return {
      ok: false,
      nodes: [],
      edges: [],
      failures,
      state: { ...initial, failures },
    };
  }

  const passes: Array<(state: LayoutState) => LayoutState> = [
    assignColumns,
    orderRows,
    stackRows,
    applyEdgePorts,
    sizeGutters,
    layoutBoundaries,
    layoutCrossCutting,
    routeEdges,
    normalizeOrigin,
    snapGeometry,
  ];

  const final = passes.reduce<LayoutState>((state, pass) => pass(state), initial);

  return {
    ok: final.failures.length === 0,
    nodes: toReactFlowNodes(final),
    edges: toReactFlowEdges(final),
    failures: final.failures,
    state: final,
  };
}

/**
 * Boundaries become React Flow parent nodes, so children move with them and the canvas
 * keeps its existing containment behaviour.
 */
function toReactFlowNodes(state: LayoutState): Node[] {
  const nodes: Node[] = [];

  // Parents must precede children in the array for React Flow to resolve them.
  const boundaries = [...state.boundaries.values()].sort((a, b) => a.depth - b.depth);

  for (const boundary of boundaries) {
    const parent = boundary.parentBoundaryId
      ? state.boundaries.get(boundary.parentBoundaryId)
      : undefined;

    nodes.push({
      id: boundary.id,
      type: "panel",
      // React Flow child coordinates are relative to the parent.
      position: parent
        ? { x: boundary.x - parent.x, y: boundary.y - parent.y }
        : { x: boundary.x, y: boundary.y },
      ...(parent ? { parentId: parent.id, extent: "parent" as const } : {}),
      width: boundary.width,
      height: boundary.height,
      data: {
        elementId: boundary.id,
        name: boundary.name,
        type: "panel",
        boundaryKind: boundary.kind,
      },
    });
  }

  for (const node of state.nodes.values()) {
    const parent = node.boundaryId ? state.boundaries.get(node.boundaryId) : undefined;

    nodes.push({
      id: node.id,
      type: "c4",
      position: parent ? { x: node.x - parent.x, y: node.y - parent.y } : { x: node.x, y: node.y },
      ...(parent ? { parentId: parent.id, extent: "parent" as const } : {}),
      width: node.width,
      height: node.height,
      data: {
        elementId: node.id,
        name: node.name,
        type: node.type,
        technology: node.technology,
        description: node.description,
        awsService: node.awsService,
        tier: node.tier,
        emphasis: node.emphasis,
      },
    });
  }

  return nodes;
}

function toReactFlowEdges(state: LayoutState): Edge[] {
  return state.connections.map((connection) => ({
    id: connection.id,
    source: connection.from,
    target: connection.to,
    label: connection.label,
    data: {
      intent: connection.intent,
      technology: connection.technology,
      isPrimaryPath: connection.isPrimaryPath,
      sourceAnchor: connection.sourceAnchor,
      targetAnchor: connection.targetAnchor,
    },
  }));
}
