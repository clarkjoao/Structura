import { useCallback, useMemo, useRef } from "react";
import { useStoreApi } from "@xyflow/react";

export interface ReconnectAnchorsDuringDrag {
  /** A node drag started: edges drop their reconnect anchors until it ends. */
  onNodeDragStart: () => void;
  /** The drag ended: the anchors come back as they were. */
  onNodeDragStop: () => void;
}

/**
 * Takes React Flow's edge reconnect anchors off the canvas while nodes are
 * dragged.
 *
 * Every reconnectable edge draws two invisible circles at its ends, and an
 * edge on a moving node moves them on every drag frame: two more attribute
 * writes, style recalculations and React updates per edge per frame. Nobody
 * can grab an anchor while the pointer is busy dragging a node, so the
 * anchors are dropped for the gesture and restored when it ends — reconnecting
 * works exactly as before once the nodes are let go. Measured dragging 169 of
 * 400 nodes: long tasks per gesture 28 -> 5 (1490 -> 250 ms) with the anchors off alone.
 *
 * Writes React Flow's store directly: `<ReactFlow>` is never handed
 * `edgesReconnectable`, so its `StoreUpdater` does not overwrite the value, and
 * a prop would re-render the whole Canvas at both ends of every drag.
 */
export function useReconnectAnchorsOffWhileDragging(): ReconnectAnchorsDuringDrag {
  const store = useStoreApi();
  const restoreRef = useRef<boolean | null>(null);

  const onNodeDragStart = useCallback(() => {
    if (restoreRef.current !== null) return;
    const { edgesReconnectable } = store.getState();
    restoreRef.current = edgesReconnectable;
    if (edgesReconnectable) store.setState({ edgesReconnectable: false });
  }, [store]);

  const onNodeDragStop = useCallback(() => {
    const restore = restoreRef.current;
    restoreRef.current = null;
    if (restore) store.setState({ edgesReconnectable: true });
  }, [store]);

  return useMemo(() => ({ onNodeDragStart, onNodeDragStop }), [onNodeDragStart, onNodeDragStop]);
}
