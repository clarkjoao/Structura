import { useState, useEffect, useRef } from "react";
import { fileSystemAdapter } from "@/infrastructure/persistence/FileSystemAdapter";
import { hydrateIconStoreFromWorkspace } from "@/infrastructure/persistence/fileSystemBoot";
import { useDiagramStore } from "@/features/diagram";
import { useCustomComponentStore } from "@/features/custom-components";
import { mergeCustomComponentTemplates } from "@/infrastructure/persistence/merge-custom-component-templates";
import {
  LAST_FOLDER_SYNC_STORAGE_KEY,
  recordFolderSyncSuccess,
} from "@/infrastructure/persistence/folderSyncTimestamp";

/** Minimum gap between two successive focus-triggered syncs. */
const FOCUS_SYNC_COOLDOWN_MS = 15_000;

/**
 * If the filesystem manifest was written within this many ms of our last sync
 * timestamp, treat it as "in sync" and skip the pull. Absorbs clock skew and
 * the tail-end of the local debounce flush window.
 */
const FS_STALENESS_TOLERANCE_MS = 3_000;

function readLastFolderSyncMs(): number | null {
  try {
    const raw = localStorage.getItem(LAST_FOLDER_SYNC_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Pulls from the connected workspace folder whenever the browser tab regains
 * visibility, but only when the filesystem manifest is newer than our last
 * successful sync. Mount this hook only in workspace-area pages.
 *
 * Flow on tab focus:
 *   1. Read structura-manifest.json (single cheap file read)
 *   2. Compare manifest.updatedAt vs lastFolderSync timestamp in localStorage
 *   3. If FS is newer → loadWorkspace() → hydrate store
 *   4. If already in sync → no-op
 */
export function useWorkspaceFocusSync(): { isSyncing: boolean } {
  const [isSyncing, setIsSyncing] = useState(false);
  const cooldownRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (!fileSystemAdapter.isConnected) return;
      if (activeRef.current) return;

      const now = Date.now();
      if (now - cooldownRef.current < FOCUS_SYNC_COOLDOWN_MS) return;

      try {
        // Cheap check: read only the manifest before deciding to do a full load.
        const manifest = await fileSystemAdapter.readManifest();
        if (!manifest) return;

        const fsTime = Date.parse(manifest.updatedAt);
        const lastSyncMs = readLastFolderSyncMs();

        // FS hasn't been written since our last sync → nothing to pull.
        if (lastSyncMs !== null && fsTime <= lastSyncMs + FS_STALENESS_TOLERANCE_MS) return;

        activeRef.current = true;
        cooldownRef.current = now;
        setIsSyncing(true);

        const workspace = await fileSystemAdapter.loadWorkspace();
        if (!workspace) return;

        const hydrated = hydrateIconStoreFromWorkspace(workspace);

        useDiagramStore.setState((s) => ({
          ...s,
          diagrams: hydrated.diagrams as typeof s.diagrams,
          serviceRegistry: workspace.serviceRegistry as typeof s.serviceRegistry,
          folders: workspace.folders as typeof s.folders,
          activeDiagramId: workspace.activeDiagramId,
          past: [],
          future: [],
        }));

        fileSystemAdapter.setFolders(
          workspace.folders as unknown as ReturnType<typeof useDiagramStore.getState>["folders"],
        );

        if (workspace.customComponentTemplates) {
          useCustomComponentStore.setState((s) => ({
            templates: mergeCustomComponentTemplates(s.templates, workspace.customComponentTemplates!),
          }));
        }

        // Record the pull as a sync event so the UI shows "synced now" and
        // subsequent focus checks correctly skip if no further FS writes happen.
        recordFolderSyncSuccess();
      } catch (e) {
        console.error("[useWorkspaceFocusSync] focus sync failed:", e);
      } finally {
        activeRef.current = false;
        setIsSyncing(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return { isSyncing };
}
