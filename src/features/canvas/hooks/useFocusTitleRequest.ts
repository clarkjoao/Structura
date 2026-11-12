import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";

/**
 * The element panel's "focus the title" signal: a counter the panel watches.
 * A request bumps it; selecting another element resets it, which tells a
 * focused title input to let go.
 */
export function useFocusTitleRequest(
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  setFocusTitleTrigger: Dispatch<SetStateAction<number>>,
): () => void {
  useEffect(() => {
    setFocusTitleTrigger(0);
  }, [selectedNodeId, selectedEdgeId, setFocusTitleTrigger]);

  return useCallback(() => {
    setFocusTitleTrigger((value) => value + 1);
  }, [setFocusTitleTrigger]);
}
