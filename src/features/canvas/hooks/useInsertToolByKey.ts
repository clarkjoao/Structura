import { useCallback, type RefObject } from "react";
import { KEY } from "@/lib/core/keyboard";
import { registryCatalog, TOOLBAR_TOOLS } from "../catalog/toolbarTools";
import { useInsertAtCenter } from "../catalog/useInsertAtCenter";
import { useCreateTextAtPointer } from "../text/useCreateTextAtPointer";

/**
 * A toolbar insert (N, P, L) or the text tool (T) from the keyboard. The
 * returned function answers false when the key is not one, so the key stays free.
 */
export function useInsertToolByKey(
  canvasRef: RefObject<HTMLElement | null>,
  isPanelOpen: boolean,
  onInserted: (nodeId: string) => void,
): (key: string) => boolean {
  const insertAtCenter = useInsertAtCenter(isPanelOpen, onInserted);
  const createTextAtPointer = useCreateTextAtPointer(canvasRef, onInserted);

  return useCallback(
    (key: string) => {
      if (key === KEY.T) {
        return createTextAtPointer();
      }
      const tool = TOOLBAR_TOOLS.find((candidate) => candidate.key === key);
      if (!tool) return false;
      const entry = registryCatalog().byId.get(tool.entryId);
      if (!entry) return false;
      insertAtCenter(entry);
      return true;
    },
    [insertAtCenter, createTextAtPointer],
  );
}
