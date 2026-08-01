/**
 * Diagram metrics, and the harness that measures both paths with the same ruler.
 *
 * The legacy path is reconstructed from the coordinates a model produced, using the same
 * measurement the engine uses — otherwise the comparison would be between "boxes the model
 * imagined" and "boxes the browser draws", which is not a fair test of layout.
 */

import { approximateMeasureText, measureNodes } from "@/lib/layout-engine";
import { layoutDiagram } from "@/lib/layout-engine";
import type { ComponentType } from "@/features/diagram";
import type { LayoutNode, LayoutState, Tier } from "@/lib/layout-engine/types";
import { TIER_ORDER } from "@/lib/layout-engine/types";
import { validateGeometry } from "@/lib/validators";
import { overlapArea } from "@/lib/validators/geometry";
import { toLayoutInput } from "../ir";
import type { EvalCase, LegacyEdge, LegacyNode } from "./cases";

export interface DiagramMetrics {
  /** Readability score (lower is better). */
  readabilityScore: number;
  throughVertexRoutes: number;
  edgeCrossings: number;
  totalEdgeLength: number;

  overlapAreaPx: number;
  overlappingPairs: number;

  errors: number;
  warnings: number;

  gridAlignmentPct: number;
  nodeCount: number;
  edgeCount: number;
}

function measureState(state: LayoutState): DiagramMetrics {
  const report = validateGeometry(state);
  const nodes = [...state.nodes.values()];

  let overlapAreaPx = 0;
  let overlappingPairs = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const area = overlapArea(
        { x: a.x, y: a.y, width: a.width, height: a.height },
        { x: b.x, y: b.y, width: b.width, height: b.height },
      );
      if (area > 0) {
        overlapAreaPx += area;
        overlappingPairs += 1;
      }
    }
  }

  const aligned = nodes.filter((node) => node.x % 10 === 0 && node.y % 10 === 0).length;

  return {
    readabilityScore: report.readability.score,
    throughVertexRoutes: report.readability.throughVertexRoutes,
    edgeCrossings: report.readability.edgeCrossings,
    totalEdgeLength: report.readability.totalEdgeLength,
    overlapAreaPx: Math.round(overlapAreaPx),
    overlappingPairs,
    errors: report.errors,
    warnings: report.warnings,
    gridAlignmentPct: nodes.length === 0 ? 100 : Math.round((aligned / nodes.length) * 100),
    nodeCount: nodes.length,
    edgeCount: state.connections.length,
  };
}

/**
 * Rebuilds the state a hand-placed diagram produces: model coordinates, engine measurement.
 * No layout pass runs — the positions are taken exactly as the model gave them.
 */
export function measureLegacy(nodes: LegacyNode[], edges: LegacyEdge[]): DiagramMetrics {
  const sizes = measureNodes(
    nodes.map((node) => ({
      id: node.id,
      type: node.type as ComponentType,
      name: node.name,
      technology: node.technology,
      description: node.description,
    })),
    { measureText: approximateMeasureText },
  );

  const layoutNodes = new Map<string, LayoutNode>();
  for (const node of nodes) {
    const size = sizes.get(node.id)!;
    layoutNodes.set(node.id, {
      id: node.id,
      type: node.type as ComponentType,
      name: node.name,
      technology: node.technology,
      description: node.description,
      tier: "application" as Tier,
      emphasis: "default",
      width: size.width,
      height: size.height,
      x: node.x,
      y: node.y,
    });
  }

  const state: LayoutState = {
    nodes: layoutNodes,
    boundaries: new Map(),
    connections: edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      intent: "call",
      isPrimaryPath: false,
    })),
    columns: [],
    tiers: TIER_ORDER,
    density: "medium",
    primaryPath: [],
    failures: [],
  };

  return measureState(state);
}

/** Measures the engine path for a case. */
export function measureEngine(evalCase: EvalCase): DiagramMetrics {
  const result = layoutDiagram(toLayoutInput(evalCase.ir), {
    measureText: approximateMeasureText,
  });
  return measureState(result.state);
}

export interface CaseComparison {
  id: string;
  title: string;
  legacy: DiagramMetrics;
  engine: DiagramMetrics;
}

export function compareCase(evalCase: EvalCase): CaseComparison {
  return {
    id: evalCase.id,
    title: evalCase.title,
    legacy: measureLegacy(evalCase.legacy.nodes, evalCase.legacy.edges),
    engine: measureEngine(evalCase),
  };
}

/** Mean of a metric across cases. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
