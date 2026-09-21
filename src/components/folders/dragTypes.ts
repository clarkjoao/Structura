/**
 * The `dataTransfer` types that carry an item's id while it is dragged onto a
 * folder.
 *
 * One per library, deliberately: the shared `FolderTree` reads only the type it
 * was given, so a diagram dropped on the walkthrough rail yields no id and
 * nothing moves. Sharing one type between the two would let each library file
 * the other's items.
 */
export const DIAGRAM_DRAG_MIME = "application/x-structura-diagram-id";
export const WALKTHROUGH_DRAG_MIME = "application/x-structura-walkthrough-id";

/**
 * A scene being dragged to a new position in its own walkthrough.
 *
 * Not a folder drop like the two above — it never leaves its list — but it
 * lives here so every drag identifier in the app is declared in one place.
 */
export const WALKTHROUGH_SCENE_DRAG_MIME = "application/x-structura-walkthrough-scene";
