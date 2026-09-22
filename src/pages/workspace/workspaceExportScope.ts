import type { Diagram, Folder } from "@/features/diagram";

export type WorkspaceExportScope = "selected" | "folder" | "workspace";

/** Ids of `folderId` and every folder beneath it. Cycle-safe. */
function collectFolderSubtree(folderId: string, folders: Record<string, Folder>): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of Object.values(folders)) {
    if (!folder.parentId) continue;
    const siblings = childrenByParent.get(folder.parentId) ?? [];
    siblings.push(folder.id);
    childrenByParent.set(folder.parentId, siblings);
  }

  const subtree = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || subtree.has(id)) continue;
    subtree.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return subtree;
}

/** Diagrams filed in `folderId` or any of its subfolders, in workspace order. */
export function diagramsInFolderTree(
  folderId: string,
  diagrams: Diagram[],
  folders: Record<string, Folder>,
): Diagram[] {
  const subtree = collectFolderSubtree(folderId, folders);
  return diagrams.filter((diagram) => diagram.folderId != null && subtree.has(diagram.folderId));
}

/**
 * The dashboard selection holds diagram ids and folder ids together. A selected folder
 * stands for every diagram beneath it, so the export never silently skips it.
 */
export function diagramsInSelection(
  selectedIds: ReadonlySet<string>,
  diagrams: Diagram[],
  folders: Record<string, Folder>,
): Diagram[] {
  const selectedFolderTree = new Set<string>();
  for (const id of selectedIds) {
    if (!folders[id]) continue;
    for (const folderId of collectFolderSubtree(id, folders)) selectedFolderTree.add(folderId);
  }
  return diagrams.filter(
    (diagram) =>
      selectedIds.has(diagram.id) ||
      (diagram.folderId != null && selectedFolderTree.has(diagram.folderId)),
  );
}

export interface WorkspaceExportScopeInput {
  diagrams: Diagram[];
  folders: Record<string, Folder>;
  selectedIds: ReadonlySet<string>;
  selectedFolderId: string | null;
}

export function diagramsForScope(
  scope: WorkspaceExportScope,
  { diagrams, folders, selectedIds, selectedFolderId }: WorkspaceExportScopeInput,
): Diagram[] {
  switch (scope) {
    case "selected":
      return diagramsInSelection(selectedIds, diagrams, folders);
    case "folder":
      return selectedFolderId ? diagramsInFolderTree(selectedFolderId, diagrams, folders) : [];
    case "workspace":
      return diagrams;
  }
}

/** Open on the narrowest scope that has something in it. */
export function defaultExportScope(
  counts: Record<WorkspaceExportScope, number>,
): WorkspaceExportScope {
  if (counts.selected > 0) return "selected";
  if (counts.folder > 0) return "folder";
  return "workspace";
}
