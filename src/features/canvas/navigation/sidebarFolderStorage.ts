const SIDEBAR_FOLDERS_KEY = "structura:sidebarFolders";

export function readSidebarExpandedFolderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SIDEBAR_FOLDERS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function writeSidebarExpandedFolderIds(ids: Set<string>): void {
  localStorage.setItem(SIDEBAR_FOLDERS_KEY, JSON.stringify([...ids]));
}
