import type { Diagram, DiagramStore } from "@/features/diagram";

/**
 * Returns true when two diagram states are equivalent for folder JSON export,
 * **excluding viewport** (pan/zoom). Used to avoid debounced FS writes on
 * viewport-only updates.
 */
export function diagramsEqualForFolderSync(a: Diagram, b: Diagram): boolean {
  if (a === b) return true;
  if (a.id !== b.id) return false;
  if (a.updatedAt !== b.updatedAt) return false;
  if (a.snapshot !== b.snapshot) return false;
  if (a.nodeLayouts !== b.nodeLayouts) return false;
  if (a.edgeLayouts !== b.edgeLayouts) return false;
  if (a.name !== b.name) return false;
  if (a.description !== b.description) return false;
  if (a.domain !== b.domain) return false;
  if (a.level !== b.level) return false;
  if (a.createdAt !== b.createdAt) return false;
  if (a.folderId !== b.folderId) return false;
  if (a.scenes !== b.scenes) return false;
  if (a.activeSceneId !== b.activeSceneId) return false;
  if (a.compareSceneId !== b.compareSceneId) return false;
  return true;
}

/** True when nothing relevant to folder JSON changed except possibly viewports. */
export function diagramStoreWorkspaceEqualsForFolderSync(
  next: DiagramStore,
  prev: DiagramStore,
): boolean {
  if (next === prev) return true;
  if (next.activeDiagramId !== prev.activeDiagramId) return false;
  if (next.folders !== prev.folders) return false;
  if (next.serviceRegistry !== prev.serviceRegistry) return false;

  const nextIds = Object.keys(next.diagrams);
  const prevIds = Object.keys(prev.diagrams);
  if (nextIds.length !== prevIds.length) return false;

  for (const id of nextIds) {
    const a = next.diagrams[id];
    const b = prev.diagrams[id];
    if (!a || !b || !diagramsEqualForFolderSync(a, b)) return false;
  }
  return true;
}
