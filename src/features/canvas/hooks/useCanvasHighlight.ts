import { useCallback, useRef, useState } from "react";

export interface UseCanvasHighlightResult {
  highlightedConnectionIds: Set<string>;
  highlightedNodeIds: Set<string>;
  setHighlight: (connectionIds: string | readonly string[], nodeIds: readonly string[]) => void;
  clearHighlight: () => void;
}

function toIdSet(connectionIds: string | readonly string[]): Set<string> {
  return new Set(typeof connectionIds === "string" ? [connectionIds] : connectionIds);
}

/** Encapsulates hover/flow-step highlight state (one or many connections). */
export function useCanvasHighlight(): UseCanvasHighlightResult {
  const [highlightedConnectionIds, setHighlightedConnectionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(() => new Set());
  const emptySet = useRef(new Set<string>()).current;

  const setHighlight = useCallback(
    (connectionIds: string | readonly string[], nodeIds: readonly string[]) => {
      setHighlightedConnectionIds(toIdSet(connectionIds));
      setHighlightedNodeIds(new Set(nodeIds));
    },
    [],
  );

  const clearHighlight = useCallback(() => {
    setHighlightedConnectionIds((prev) => (prev.size === 0 ? prev : emptySet));
    setHighlightedNodeIds((prev) => (prev.size === 0 ? prev : emptySet));
  }, [emptySet]);

  return {
    highlightedConnectionIds,
    highlightedNodeIds,
    setHighlight,
    clearHighlight,
  };
}
