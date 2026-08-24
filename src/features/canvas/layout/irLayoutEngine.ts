import type { ElkNode } from "elkjs";
// Leaf import, not the `ir` barrel: the barrel reaches back into this module.
import { isBoundaryNode, type DiagramIR } from "@/features/llm/ir/ir.types";
import {
  layoutGraph,
  layoutGraphElk,
  type GraphLayoutResult,
  type LayoutBox,
  type LayoutGraphEdge,
  type LayoutGraphNode,
} from "./graphLayoutEngine";

/**
 * ELK layout for a generated IR — an adapter over `graphLayoutEngine`.
 *
 * The IR is one of two structural formats the canvas lays out (the other is
 * ASL), and neither carries geometry. Everything that is genuinely about ELK —
 * the option set, container fitting, the empty-boundary size, the parent-
 * relative coordinates — lives in the shared engine; this module only says how
 * an `IRNode` answers "am I a container?".
 *
 * Deliberately a single, direct pass. There is no tier mechanism here — `tier`
 * travels through the IR untouched until that decision is made.
 */

export type IRLayoutBox = LayoutBox;
export type IRLayoutResult = GraphLayoutResult;

function toLayoutNodes(ir: DiagramIR): LayoutGraphNode[] {
  return ir.nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    isContainer: isBoundaryNode(node),
  }));
}

function toLayoutEdges(ir: DiagramIR): LayoutGraphEdge[] {
  return ir.edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
  }));
}

/**
 * Runs ELK and returns its graph untouched, so the readability counter can
 * measure the same output the canvas is built from and layout options can be
 * compared without going through the store.
 */
export async function layoutIRGraph(
  ir: DiagramIR,
  optionOverrides: Record<string, string> = {},
): Promise<ElkNode> {
  return layoutGraphElk(toLayoutNodes(ir), toLayoutEdges(ir), optionOverrides);
}

/**
 * Lays out every node of the IR. Positions come back relative to the parent
 * (root nodes relative to the canvas origin), which is exactly what React Flow
 * expects from a child node.
 */
export async function layoutIR(ir: DiagramIR): Promise<IRLayoutResult> {
  return layoutGraph(toLayoutNodes(ir), toLayoutEdges(ir));
}
