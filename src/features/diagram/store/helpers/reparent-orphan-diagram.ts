import type { Diagram, Folder } from "../../model/diagram.types";

type FolderRecord = Record<string, Folder>;

/**
 * A diagram file carries the `folderId` of the workspace it was exported from. That id is
 * meaningless in the receiving workspace, and a diagram pointing at a folder that does not
 * exist renders nowhere: both the dashboard and the diagram sidebar list diagrams by exact
 * `folderId` match, so it shows up neither at the root nor inside any folder.
 *
 * Returns the same reference when nothing changes, so callers can use identity to detect a fix.
 */
export function reparentOrphanDiagram<T extends Diagram>(diagram: T, folders: FolderRecord): T {
  const folderId = diagram.folderId;
  if (!folderId) return diagram;
  if (folders[folderId]) return diagram;

  const { folderId: _orphan, ...rest } = diagram;
  return rest as T;
}

/** Map variant of {@link reparentOrphanDiagram}. Returns the same reference when nothing changes. */
export function reparentOrphanDiagrams<T extends Diagram>(
  diagrams: Record<string, T>,
  folders: FolderRecord,
): Record<string, T> {
  let dirty = false;
  const next: Record<string, T> = {};

  for (const [id, diagram] of Object.entries(diagrams)) {
    const reparented = reparentOrphanDiagram(diagram, folders);
    if (reparented !== diagram) dirty = true;
    next[id] = reparented;
  }

  return dirty ? next : diagrams;
}
