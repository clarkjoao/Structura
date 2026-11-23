import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

/**
 * The element panel's "focus the title" signal: a counter the panel watches.
 * A request bumps it; selecting another element resets it, which tells a
 * focused title input to let go.
 *
 * A request may name the element it is for (a gesture that selects what it
 * just made and opens its name): the selection change that follows would
 * reset the counter after the bump, so the request waits for that selection
 * and bumps once it lands.
 */
export function useFocusTitleRequest(
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  setFocusTitleTrigger: Dispatch<SetStateAction<number>>,
): (forId?: string) => void {
  const pendingFor = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(selectedNodeId ?? selectedEdgeId);
  selectedRef.current = selectedNodeId ?? selectedEdgeId;

  useEffect(() => {
    const selected = selectedNodeId ?? selectedEdgeId;
    if (pendingFor.current !== null && pendingFor.current === selected) {
      pendingFor.current = null;
      setFocusTitleTrigger((value) => value + 1);
      return;
    }
    setFocusTitleTrigger(0);
  }, [selectedNodeId, selectedEdgeId, setFocusTitleTrigger]);

  return useCallback(
    (forId?: string) => {
      if (forId !== undefined && forId !== selectedRef.current) {
        pendingFor.current = forId;
        return;
      }
      pendingFor.current = null;
      setFocusTitleTrigger((value) => value + 1);
    },
    [setFocusTitleTrigger],
  );
}
