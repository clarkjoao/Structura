/** Drag payload for a catalog tile: the entry id, dropped on the canvas at the pointer. */
export const CATALOG_ENTRY_DRAG_MIME = "application/structura-catalog-entry";

export function startCatalogEntryDrag(event: React.DragEvent, entryId: string): void {
  event.dataTransfer.setData(CATALOG_ENTRY_DRAG_MIME, entryId);
  event.dataTransfer.effectAllowed = "copy";
}

export function isCatalogEntryDrag(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(CATALOG_ENTRY_DRAG_MIME);
}

export function catalogEntryIdFromDrop(event: React.DragEvent): string | null {
  return event.dataTransfer.getData(CATALOG_ENTRY_DRAG_MIME) || null;
}
