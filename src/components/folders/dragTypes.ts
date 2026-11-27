/**
 * The `dataTransfer` types that carry an item's id while it is dragged onto a
 * folder.
 *
 * The shared `FolderTree` reads only the type it was given, so an item of
 * another type yields no id and nothing moves.
 */
export const DIAGRAM_DRAG_MIME = "application/x-structura-diagram-id";
