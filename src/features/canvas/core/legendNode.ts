import type { Node } from "@xyflow/react";
import { buildLegend, isLegendEmpty, type LegendModel } from "@/features/diagram/utils/legend";
import type { ViewSnapshot } from "./resolveViewSnapshot";
import { DEFAULT_NODE_H } from "@/features/diagram/model/layout.constants";

/** The React Flow type, and the id, of the generated legend. It is not an element of the diagram. */
export const LEGEND_NODE_TYPE = "diagram-legend";
export const LEGEND_NODE_ID = "__diagram-legend__";

/** Room between the diagram and its legend. */
const LEGEND_GAP = 80;

/** What the legend says of this view, or null when it has nothing to say. */
function legendOfView(view: ViewSnapshot): LegendModel | null {
  const shown = new Set(view.nodes.filter((n) => !n.isHidden).map((n) => n.component.id));
  const legend = buildLegend(view.components, shown, view.shownConnections);
  return isLegendEmpty(legend) ? null : legend;
}

/**
 * The legend as a node, under the diagram and aligned with its left edge, when the diagram asks
 * for it. The editor and the viewer both append this to what `projectNodes` returns — its place is
 * derived, never stored, so there is nothing to drag or to save.
 */
export function projectLegendNode(view: ViewSnapshot, showLegend: boolean): Node | null {
  if (!showLegend) return null;
  const legend = legendOfView(view);
  if (!legend) return null;
  const roots = view.nodes.filter((n) => !n.isHidden && !n.isChild && n.layout);
  if (roots.length === 0) return null;
  const left = Math.min(...roots.map((n) => n.layout?.x ?? 0));
  const bottom = Math.max(
    ...roots.map((n) => (n.layout?.y ?? 0) + (n.layout?.height ?? DEFAULT_NODE_H)),
  );
  return {
    id: LEGEND_NODE_ID,
    type: LEGEND_NODE_TYPE,
    position: { x: left, y: bottom + LEGEND_GAP },
    data: { legend },
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
    deletable: false,
    zIndex: 0,
  };
}
