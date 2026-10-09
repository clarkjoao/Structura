import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramStore } from "@/features/diagram";
import { useElementPresetStore } from "@/features/element-presets";
import type { CatalogEntry } from "@/features/elements/search";
import { buildCanvasCatalogIndex, catalogEntriesById } from "./canvasCatalogIndex";
import { catalogEntryIdFromDrop, isCatalogEntryDrag } from "./catalogDrag";
import { useCatalogUiStore } from "./catalogUi.store";
import { registryCatalog } from "./toolbarTools";
import { useCatalogInsert } from "./useCatalogInsert";

/** The entry a dropped id names: the registry first, then the services and presets. */
function resolveDroppedEntry(id: string): CatalogEntry | undefined {
  const fromRegistry = registryCatalog().byId.get(id);
  if (fromRegistry) return fromRegistry;
  const index = buildCanvasCatalogIndex(
    Object.values(useDiagramStore.getState().services),
    Object.values(useElementPresetStore.getState().presets),
  );
  return catalogEntriesById(index).get(id);
}

/**
 * Drop target for catalog tiles: the node is created where the pointer is.
 * Each handler returns whether it took the event, so the canvas can chain it
 * with its other drop targets.
 */
export function useCatalogDrop(canEdit: boolean, onInserted: (nodeId: string) => void) {
  const reactFlow = useReactFlow();
  const insert = useCatalogInsert();

  const onDragOver = useCallback(
    (event: React.DragEvent): boolean => {
      if (!canEdit || !isCatalogEntryDrag(event)) return false;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      return true;
    },
    [canEdit],
  );

  const onDrop = useCallback(
    (event: React.DragEvent): boolean => {
      if (!canEdit) return false;
      const id = catalogEntryIdFromDrop(event);
      if (!id) return false;
      event.preventDefault();
      const entry = resolveDroppedEntry(id);
      if (!entry) return true;
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const nodeId = insert(entry, { position });
      useCatalogUiStore.getState().setOpen(false);
      if (nodeId) onInserted(nodeId);
      return true;
    },
    [canEdit, reactFlow, insert, onInserted],
  );

  return { onDragOver, onDrop };
}
