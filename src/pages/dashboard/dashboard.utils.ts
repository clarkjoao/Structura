import type { Folder } from "@/features/diagram";

export function buildBreadcrumbPath(
  folders: Record<string, Folder>,
  folderId: string | null,
): Folder[] {
  if (!folderId) return [];
  const path: Folder[] = [];
  let current: Folder | undefined = folders[folderId];
  while (current) {
    path.unshift(current);
    current = current.parentId ? folders[current.parentId] : undefined;
  }
  return path;
}
