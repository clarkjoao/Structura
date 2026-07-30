import { useCallback, useRef, useState } from "react";

export interface UseCanvasHighlightResult {
  highlightedConnectionId: string | null;
  highlightedNodeIds: Set<string>;
  setHighlight: (connectionId: string, nodeIds: string[]) => void;
  clearHighlight: () => void;
}

/** Encapsulates hover/flow-step highlight state. */
export function useCanvasHighlight(): UseCanvasHighlightResult {
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const emptySet = useRef(new Set<string>()).current;

  const setHighlight = useCallback((connectionId: string, nodeIds: string[]) => {
    setHighlightedConnectionId(connectionId);
    setHighlightedNodeIds(new Set(nodeIds));
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedConnectionId(null);
    setHighlightedNodeIds((prev) => (prev.size === 0 ? prev : emptySet));
  }, [emptySet]);

  return {
    highlightedConnectionId,
    highlightedNodeIds,
    setHighlight,
    clearHighlight,
  };
}
