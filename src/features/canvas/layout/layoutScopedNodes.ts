import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { layout } from "./layoutEngine";
import { fromDiagram, resizableIds } from "./fromDiagram";
import { toAppliedLayouts, type AppliedLayout } from "./applyLayout";
import { applyLayoutResultEdges } from "./applyLayoutResult";

export interface LayoutScopedNodesParams {
  /** The components to lay out — everything else in the diagram is left alone. */
  nodeIds: readonly string[];
  /** The connections between them that get waypoints written. */
  connectionIds: readonly string[];
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  nodeLayouts: Record<string, NodeLayout>;
  /** Where the caller wants the result centred — the canvas insertion point. */
  anchor: { x: number; y: number };
  activeDiagramId: string | null;
  applyAutoLayout: (layouts: AppliedLayout[]) => void;
}

/**
 * Lay out a freshly imported subset of a diagram and centre it on the insertion point.
 *
 * This is the mermaid/draw.io import path: the importers seed their new components on a
 * coarse grid, and this runs straight afterwards so the final positions come from the
 * engine rather than from that grid.
 *
 * It is the only consumer that anchors the result somewhere other than (0,0), which is
 * why it is also the only one passing an offset to both `toAppliedLayouts` and
 * `applyLayoutResultEdges` — the two have to receive the *same* offset or the waypoints
 * detach from the nodes they were routed between.
 *
 * @returns `true` when a layout was applied, `false` when there was nothing to lay out.
 */
export async function layoutScopedNodes(params: LayoutScopedNodesParams): Promise<boolean> {
  const {
    nodeIds,
    connectionIds,
    components,
    connections,
    nodeLayouts,
    anchor,
    activeDiagramId,
    applyAutoLayout,
  } = params;

  if (nodeIds.length === 0) return false;

  const scopedComponents = Object.fromEntries(
    nodeIds
      .map((id) => components[id])
      .filter(Boolean)
      .map((c) => [c.id, c]),
  );
  const scopedConnections = connectionIds.map((id) => connections[id]).filter(Boolean);

  const graph = fromDiagram(scopedComponents, scopedConnections, nodeLayouts);
  const result = await layout(graph);
  if (result.boxes.size === 0) return false;

  const offset = {
    x: anchor.x - result.bounds.width / 2,
    y: anchor.y - result.bounds.height / 2,
  };

  applyAutoLayout(toAppliedLayouts(graph, result, resizableIds(graph, scopedComponents), offset));

  if (activeDiagramId !== null) {
    applyLayoutResultEdges(graph, result, activeDiagramId, { waypointOffset: offset });
  }

  return true;
}
