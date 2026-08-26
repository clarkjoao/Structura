// Leaf import, not the `@/features/diagram` barrel: this module is pure mapping,
// and the barrel would drag the store in with it.
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import type { LayoutGraph, LayoutNode } from "@/features/canvas/layout/contract";
import { isBoundaryNode, type DiagramIR } from "./ir.types";

/**
 * Placeholder size for a node that holds children. ELK replaces it with the
 * fitted size, so the value only has to be non-zero.
 */
const CONTAINER_SEED_W = 240;
const CONTAINER_SEED_H = 160;

/**
 * An empty boundary keeps this size verbatim — ELK has no children to fit it
 * around — so it has to be wide enough for the header label not to truncate.
 */
const EMPTY_BOUNDARY_W = 360;
const EMPTY_BOUNDARY_H = 200;

/**
 * Turns a generated IR into a layout graph.
 *
 * This is where IR sizing policy lives: what an empty VPC is worth, how big a
 * leaf starts. The engine has no opinion about any of it — it lays out the boxes
 * it is handed.
 */
export function irToLayoutGraph(ir: DiagramIR): LayoutGraph {
  const parents = new Set(
    ir.nodes
      .map((node) => node.parentId)
      .filter((parentId): parentId is string => parentId !== null),
  );

  const nodes: LayoutNode[] = ir.nodes.map((node): LayoutNode => {
    if (parents.has(node.id)) {
      return {
        id: node.id,
        parentId: node.parentId,
        width: CONTAINER_SEED_W,
        height: CONTAINER_SEED_H,
      };
    }
    const emptyBoundary = isBoundaryNode(node);
    return {
      id: node.id,
      parentId: node.parentId,
      width: emptyBoundary ? EMPTY_BOUNDARY_W : DEFAULT_NODE_W,
      height: emptyBoundary ? EMPTY_BOUNDARY_H : DEFAULT_NODE_H,
    };
  });

  const edges = ir.edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
  }));

  return { nodes, edges };
}
