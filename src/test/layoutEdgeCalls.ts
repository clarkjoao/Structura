import type { EdgeControlPoint } from "@/features/diagram";
import type { LayoutEdgeEffects } from "@/features/diagram/store/actions.types";

/** The per-edge actions a fake store records, as the batched write used to call them. */
interface PerEdgeCalls {
  updateHandleOrder: (componentId: string, side: "incoming" | "outgoing", ids: string[]) => void;
  resetEdgeControlPoints?: (diagramId: string, connectionId: string) => void;
  setEdgeControlPoints: (
    diagramId: string,
    connectionId: string,
    points: EdgeControlPoint[],
    options?: { history?: boolean },
  ) => void;
  setEdgeLabelOffset?: (
    diagramId: string,
    connectionId: string,
    offset: number,
    options?: { history?: boolean },
  ) => void;
}

/**
 * A fake store's `applyLayoutEdges` that replays the batch as the per-edge
 * calls it replaces, so tests written against those calls keep asserting the
 * same writes.
 */
export function applyLayoutEdgesAsCalls(store: PerEdgeCalls) {
  return (diagramId: string, effects: LayoutEdgeEffects): void => {
    for (const { componentId, side, connectionIds } of effects.handleOrders) {
      store.updateHandleOrder(componentId, side, connectionIds);
    }
    for (const id of effects.resetConnectionIds) store.resetEdgeControlPoints?.(diagramId, id);
    for (const { connectionId, points, labelOffset } of effects.routes) {
      store.setEdgeControlPoints(diagramId, connectionId, points, { history: false });
      if (labelOffset !== undefined) {
        store.setEdgeLabelOffset?.(diagramId, connectionId, labelOffset, { history: false });
      }
    }
  };
}
