import { useCallback, useMemo } from "react";
import type { Node } from "@xyflow/react";
import { useNodeDragLocks } from "@/features/collaboration/hooks/useElementLocks";
import { useReconnectAnchorsOffWhileDragging } from "../edges/interaction/useReconnectAnchorsOffWhileDragging";

/**
 * The node drag as the editor canvas runs it: nodes a collaborator holds are
 * locked, a drag takes the locks and turns the edge reconnect anchors off for
 * its duration, and the drop commits through `onNodeDragStop`.
 */
export function useLockedNodeDrag(
  nodes: Node[],
  onNodeDragStop: (event: unknown, draggedNode: Node) => void,
) {
  const dragLocks = useNodeDragLocks();
  const reconnectAnchors = useReconnectAnchorsOffWhileDragging();
  const lockedNodes = useMemo(() => dragLocks.applyLocks(nodes), [dragLocks, nodes]);
  const handleNodeDragStart = useCallback(
    (...args: Parameters<typeof dragLocks.onNodeDragStart>) => {
      reconnectAnchors.onNodeDragStart();
      dragLocks.onNodeDragStart(...args);
    },
    [dragLocks, reconnectAnchors],
  );
  const handleNodeDragStop = useCallback(
    (event: Parameters<typeof onNodeDragStop>[0], node: Parameters<typeof onNodeDragStop>[1]) => {
      reconnectAnchors.onNodeDragStop();
      dragLocks.onNodeDragStop();
      onNodeDragStop(event, node);
    },
    [dragLocks, onNodeDragStop, reconnectAnchors],
  );
  return { lockedNodes, onNodeDragStart: handleNodeDragStart, onNodeDragStop: handleNodeDragStop };
}
