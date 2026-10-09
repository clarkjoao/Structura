import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import type { CatalogEntry } from "@/features/elements/search";
import { getViewportCenter } from "../viewport-utils";
import { useCatalogInsert } from "./useCatalogInsert";

/**
 * Inserts an entry at the center of the visible canvas — left of the inspector
 * when it is open — and hands the new node's id to `onInserted`.
 */
export function useInsertAtCenter(
  isPanelOpen: boolean,
  onInserted: (nodeId: string) => void,
): (entry: CatalogEntry) => string | null {
  const reactFlow = useReactFlow();
  const insert = useCatalogInsert();
  return useCallback(
    (entry) => {
      const id = insert(entry, { position: getViewportCenter(reactFlow, isPanelOpen) });
      if (id) onInserted(id);
      return id;
    },
    [insert, reactFlow, isPanelOpen, onInserted],
  );
}
