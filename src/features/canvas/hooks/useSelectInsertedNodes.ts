import { useCallback } from "react";
import type { CanvasVisualState } from "./useCanvasVisualState";

type SelectionSetters = Pick<
  CanvasVisualState,
  "setSelectedNodeId" | "setSelectedNodeIds" | "setSelectedEdgeId"
>;

/**
 * Selects what an insert just put on the canvas (a catalog drop, a toolbar or
 * keyboard insert): the new node, or the new nodes with the first as primary,
 * and no edge.
 */
export function useSelectInsertedNodes({
  setSelectedNodeId,
  setSelectedNodeIds,
  setSelectedEdgeId,
}: SelectionSetters) {
  const selectInsertedNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedNodeIds(new Set([nodeId]));
      setSelectedEdgeId(null);
    },
    [setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId],
  );
  const selectInsertedNodes = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;
      setSelectedNodeId(nodeIds[0]);
      setSelectedNodeIds(new Set(nodeIds));
      setSelectedEdgeId(null);
    },
    [setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId],
  );
  return { selectInsertedNode, selectInsertedNodes };
}
