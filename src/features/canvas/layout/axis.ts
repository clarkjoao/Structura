import type { DiagramDirection } from "@/features/diagram/model/diagram.types";
import type { LayoutBox, LayoutGraph, LayoutNode, LayoutPoint, LayoutResult } from "./contract";

/**
 * A top-to-bottom layout is a left-to-right one seen in a mirror (ADR-0013).
 *
 * Reflecting a diagram across its main diagonal — x↔y, width↔height — turns
 * the top side into the left and the bottom into the right, so an edge that
 * flows down flows right. The tuned left-to-right pipeline (ELK RIGHT with
 * EAST/WEST ports, the handle anchors, `alignElkRouteToHandles`, route
 * straightening, reference scoring) then runs untouched on the transposed
 * graph, and only its output is reflected back. Nothing downstream of ELK
 * needs to know a vertical diagram exists, and a left-to-right one goes
 * through none of this.
 *
 * Every function here is an involution: applying it twice gives the input back.
 */

export function isTopToBottom(direction: DiagramDirection | undefined): boolean {
  return direction === "TB";
}

export function transposePoint<T extends LayoutPoint>(point: T): T {
  return { ...point, x: point.y, y: point.x };
}

function transposeBox<T extends LayoutBox>(box: T): T {
  return { ...box, x: box.y, y: box.x, width: box.height, height: box.width };
}

function transposeNode(node: LayoutNode): LayoutNode {
  const { topInset, leftInset, position, ...rest } = node;
  return {
    ...rest,
    width: node.height,
    height: node.width,
    // A header's room on top is room on the left once the graph is mirrored.
    ...(topInset !== undefined && { leftInset: topInset }),
    ...(leftInset !== undefined && { topInset: leftInset }),
    ...(position && { position: transposePoint(position) }),
  };
}

export function transposeGraph(graph: LayoutGraph): LayoutGraph {
  return {
    nodes: graph.nodes.map(transposeNode),
    edges: graph.edges.map((edge) =>
      edge.labelBox
        ? {
            ...edge,
            labelBox: {
              ...edge.labelBox,
              width: edge.labelBox.height,
              height: edge.labelBox.width,
            },
          }
        : edge,
    ),
  };
}

/**
 * The result reflected back. The handle order is kept as is: "top to bottom
 * along the side" in the mirrored graph is "left to right along the side" in
 * the real one, which is the order a top or bottom side spreads its slots in
 * (`buildHandles`).
 */
export function transposeResult(result: LayoutResult): LayoutResult {
  return {
    ...result,
    boxes: new Map([...result.boxes].map(([id, box]) => [id, transposeBox(box)])),
    edgeRoutes: new Map(
      [...result.edgeRoutes].map(([id, route]) => [id, route.map(transposePoint)]),
    ),
    ...(result.labelCenters && {
      labelCenters: new Map(
        [...result.labelCenters].map(([id, point]) => [id, transposePoint(point)]),
      ),
    }),
    bounds: { width: result.bounds.height, height: result.bounds.width },
  };
}

/** Runs `run` in the mirror when the diagram reads top-to-bottom. */
export function inDirection(
  direction: DiagramDirection | undefined,
  run: (graph: LayoutGraph) => Promise<LayoutResult>,
): (graph: LayoutGraph) => Promise<LayoutResult> {
  if (!isTopToBottom(direction)) return run;
  return async (graph) => transposeResult(await run(transposeGraph(graph)));
}
