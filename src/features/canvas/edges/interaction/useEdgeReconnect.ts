import { useCallback, useMemo, useRef } from "react";
import type { Connection as FlowConnection, Edge } from "@xyflow/react";
import { useDiagramActions } from "@/features/diagram";

export interface UseEdgeReconnectResult {
  onReconnectStart: () => void;
  onReconnect: (oldEdge: Edge, newConnection: FlowConnection) => void;
  onReconnectEnd: () => void;
}

/**
 * Wires React Flow edge reconnection to the domain. Dragging an endpoint onto a
 * valid handle updates the connection's source/target (handle slots are
 * re-derived downstream). Invalid drops leave the connection unchanged.
 */
export function useEdgeReconnect(): UseEdgeReconnectResult {
  const { updateConnection } = useDiagramActions();
  const reconnectSucceededRef = useRef(false);

  const onReconnectStart = useCallback(() => {
    reconnectSucceededRef.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: FlowConnection) => {
      if (!newConnection.source || !newConnection.target) return;
      reconnectSucceededRef.current = true;
      updateConnection(oldEdge.id, {
        sourceId: newConnection.source,
        targetId: newConnection.target,
      });
    },
    [updateConnection],
  );

  // Invalid drops intentionally leave the connection untouched.
  const onReconnectEnd = useCallback(() => {
    reconnectSucceededRef.current = false;
  }, []);

  return useMemo(
    () => ({ onReconnectStart, onReconnect, onReconnectEnd }),
    [onReconnectStart, onReconnect, onReconnectEnd],
  );
}
