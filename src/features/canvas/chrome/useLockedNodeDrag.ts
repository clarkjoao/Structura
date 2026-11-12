import { useCallback, useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import { useNodeDragLocks } from "@/features/collaboration/hooks/useElementLocks";
import { useReconnectAnchorsOffWhileDragging } from "../edges/interaction/useReconnectAnchorsOffWhileDragging";
import { createDragActivity } from "../components/miniMapDragThrottle";

/**
 * The node drag as the editor canvas runs it: nodes a collaborator holds are
 * locked, a drag takes the locks and turns the edge reconnect anchors off for
 * its duration, the minimap is told when a drag is in progress so it can
 * refresh on a timer (`DragThrottledMiniMap`), and the drop commits through
 * `onNodeDragStop`.
 */
export function useLockedNodeDrag(
  nodes: Node[],
  onNodeDragStop: (event: unknown, draggedNode: Node) => void,
) {
  const dragLocks = useNodeDragLocks();
  const reconnectAnchors = useReconnectAnchorsOffWhileDragging();
  const [dragActivity] = useState(createDragActivity);
  const lockedNodes = useMemo(() => dragLocks.applyLocks(nodes), [dragLocks, nodes]);
  const handleNodeDragStart = useCallback(
    (...args: Parameters<typeof dragLocks.onNodeDragStart>) => {
      reconnectAnchors.onNodeDragStart();
      dragActivity.start();
      dragLocks.onNodeDragStart(...args);
    },
    [dragActivity, dragLocks, reconnectAnchors],
  );
  const handleNodeDragStop = useCallback(
    (event: Parameters<typeof onNodeDragStop>[0], node: Parameters<typeof onNodeDragStop>[1]) => {
      reconnectAnchors.onNodeDragStop();
      dragActivity.stop();
      dragLocks.onNodeDragStop();
      onNodeDragStop(event, node);
    },
    [dragActivity, dragLocks, onNodeDragStop, reconnectAnchors],
  );
  return {
    lockedNodes,
    dragActivity,
    onNodeDragStart: handleNodeDragStart,
    onNodeDragStop: handleNodeDragStop,
  };
}
