import { create } from "zustand";

export type FsStatus = "disconnected" | "connecting" | "connected" | "error" | "needs_permission";

/** How the last write to the connected folder went; "unknown" until one has run. */
export type FolderWriteResult = "unknown" | "ok" | "failed";

export interface FolderSyncStatusSetters {
  setStatus: (next: FsStatus | ((previous: FsStatus) => FsStatus)) => void;
  setFolderName: (name: string | null) => void;
}

interface FolderSyncStatusState extends FolderSyncStatusSetters {
  status: FsStatus;
  folderName: string | null;
  lastWrite: FolderWriteResult;
}

/**
 * Whether a folder is connected, shared by every reader.
 *
 * It used to be `useState` inside `useFileSystemStorage`, so each component that called the hook
 * had its own copy starting at "disconnected": the storage banner never learnt that the toolbar
 * had connected a folder, and kept asking to connect one.
 */
export const useFolderSyncStatusStore = create<FolderSyncStatusState>((set) => ({
  status: "disconnected",
  folderName: null,
  lastWrite: "unknown",
  setStatus: (next) =>
    set((state) => {
      const status = typeof next === "function" ? next(state.status) : next;
      // A write result belongs to one connection: leaving "connected" forgets it.
      return status === "connected" ? { status } : { status, lastWrite: "unknown" };
    }),
  setFolderName: (folderName) => set({ folderName }),
}));

/**
 * Records how a write to the folder went. Called by the folder sync (fileSystemBoot.ts), which
 * used to only log a failure: the UI then said "saved to folder" for work that never got there.
 */
export function reportFolderWrite(ok: boolean): void {
  useFolderSyncStatusStore.setState({ lastWrite: ok ? "ok" : "failed" });
}

/** The folder sync status, for UI that only needs to read it (not run the folder boot). */
export function useFolderSyncStatus(): {
  status: FsStatus;
  folderName: string | null;
  lastWrite: FolderWriteResult;
} {
  const status = useFolderSyncStatusStore((state) => state.status);
  const folderName = useFolderSyncStatusStore((state) => state.folderName);
  const lastWrite = useFolderSyncStatusStore((state) => state.lastWrite);
  return { status, folderName, lastWrite };
}
