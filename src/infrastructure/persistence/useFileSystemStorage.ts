import { useState, useEffect, useCallback } from "react";
import { fileSystemAdapter } from "./FileSystemAdapter";
import type { WorkspaceScanResult } from "./FileSystemAdapter";
import { useDiagramStore } from "@/features/diagram";
import { partializeState, PERSIST_KEY } from "@/features/diagram/store/persist.config";
import { defaultStorage } from "./LocalStorageAdapter";
import {
  bootFileSystem,
  resetBootState,
  startFileSystemSync,
  stopFileSystemSync,
} from "./fileSystemBoot";

/** Remove the diagram-store key from localStorage so the folder becomes the sole source of truth. */
async function clearLocalCache(): Promise<void> {
  await defaultStorage.delete(PERSIST_KEY);
}

export type FsStatus = "disconnected" | "connecting" | "connected" | "error";

export const isFileSystemSupported = "showDirectoryPicker" in globalThis;

function buildManifest(state: ReturnType<typeof useDiagramStore.getState>) {
  return {
    version: 1 as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    diagramIds: Object.keys(state.diagrams),
    serviceRegistry: state.serviceRegistry,
    folders: state.folders,
    activeDiagramId: state.activeDiagramId,
  };
}

export function useFileSystemStorage() {
  const [status, setStatus] = useState<FsStatus>("disconnected");
  const [folderName, setFolderName] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<WorkspaceScanResult | null>(
    null
  );
  const [pendingMerge, setPendingMerge] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const clearStore = useCallback(() => {
    useDiagramStore.setState({
      diagrams: {},
      folders: {},
      serviceRegistry: {},
      activeDiagramId: null,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
      clipboard: null,
    });
  }, []);

  // Silent reconnect on mount — delegates to the singleton so it runs only once
  useEffect(() => {
    if (!isFileSystemSupported) return;

    // If already connected (another mount already completed boot), just sync local state
    if (fileSystemAdapter.isConnected) {
      defaultStorage.paused = true;
      setStatus("connected");
      setFolderName(fileSystemAdapter.folderName);
      return;
    }

    bootFileSystem().then((ok) => {
      if (ok) {
        setStatus("connected");
        setFolderName(fileSystemAdapter.folderName);
        startFileSystemSync();
      }
    });
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    const ok = await fileSystemAdapter.connect();
    if (!ok) {
      setStatus("disconnected");
      return;
    }

    setFolderName(fileSystemAdapter.folderName);

    const scan = await fileSystemAdapter.scanWorkspace();

    if (scan.valid.length === 0 && scan.totalFilesScanned === 0) {
      // Empty folder — write current store to disk
      const state = useDiagramStore.getState();
      fileSystemAdapter.setFolders(state.folders);
      for (const diagram of Object.values(state.diagrams)) {
        await fileSystemAdapter.writeDiagram(diagram);
      }
      await fileSystemAdapter.writeManifest(buildManifest(state));
      defaultStorage.paused = true;
      await clearLocalCache();
      startFileSystemSync();
      setStatus("connected");
      return;
    }

    if (scan.valid.length === 0) {
      // Folder has files but none are valid diagrams — just connect
      defaultStorage.paused = true;
      await clearLocalCache();
      startFileSystemSync();
      setStatus("connected");
      return;
    }

    // Folder has valid diagrams — show merge dialog
    setScanResult(scan);
    setPendingMerge(true);
    defaultStorage.paused = true;
    setStatus("connected");
  }, []);

  const confirmMerge = useCallback(async () => {
    if (!scanResult) return;
    const validDiagrams = Object.fromEntries(
      scanResult.valid.map((d) => [d.id, d])
    );
    useDiagramStore.setState((s) => ({
      ...s,
      diagrams: { ...s.diagrams, ...validDiagrams },
    }));
    if (scanResult.manifest) {
      fileSystemAdapter.setFolders(scanResult.manifest.folders as any);
    }
    await clearLocalCache();
    startFileSystemSync();
    setScanResult(null);
    setPendingMerge(false);
  }, [scanResult]);

  const confirmOverwrite = useCallback(async () => {
    if (!scanResult) return;
    const validDiagrams = Object.fromEntries(
      scanResult.valid.map((d) => [d.id, d])
    );
    useDiagramStore.setState((s) => ({
      ...s,
      diagrams: validDiagrams,
      ...(scanResult.manifest
        ? {
            serviceRegistry: scanResult.manifest.serviceRegistry as any,
            folders: scanResult.manifest.folders as any,
            activeDiagramId: scanResult.manifest.activeDiagramId,
          }
        : {}),
    }));
    if (scanResult.manifest) {
      fileSystemAdapter.setFolders(scanResult.manifest.folders as any);
    }
    await clearLocalCache();
    startFileSystemSync();
    setScanResult(null);
    setPendingMerge(false);
  }, [scanResult]);

  const cancelMerge = useCallback(async () => {
    await fileSystemAdapter.disconnect();
    defaultStorage.paused = false;
    resetBootState();
    setScanResult(null);
    setPendingMerge(false);
    setStatus("disconnected");
    setFolderName(null);
  }, []);

  const requestDisconnect = useCallback(() => {
    setPendingDisconnect(true);
  }, []);

  const performDisconnect = useCallback(async () => {
    await fileSystemAdapter.disconnect();
    defaultStorage.paused = false;
    resetBootState();
    setStatus("disconnected");
    setFolderName(null);
    setPendingDisconnect(false);
  }, []);

  const confirmDisconnectWithBackup = useCallback(async () => {
    try {
      const state = useDiagramStore.getState();
      const toSave = partializeState(state);
      await defaultStorage.forceSave(PERSIST_KEY, toSave);

      const saved = await defaultStorage.getItem(PERSIST_KEY);
      if (saved === null) {
        setStatus("error");
        setPendingDisconnect(false);
        return;
      }

      await performDisconnect();
    } catch {
      setStatus("error");
      setPendingDisconnect(false);
    }
  }, [performDisconnect]);

  const confirmDisconnectWithoutBackup = useCallback(async () => {
    clearStore();
    await defaultStorage.delete(PERSIST_KEY);
    await performDisconnect();
  }, [clearStore, performDisconnect]);

  const syncFromFolder = useCallback(async () => {
    if (!fileSystemAdapter.isConnected) return;
    setSyncing(true);
    try {
      // Prefer manifest-based load (supports deletions).
      const workspace = await fileSystemAdapter.loadWorkspace();
      if (workspace) {
        useDiagramStore.setState((s) => ({
          ...s,
          diagrams: workspace.diagrams as any,
          serviceRegistry: workspace.serviceRegistry as any,
          folders: workspace.folders as any,
          activeDiagramId: workspace.activeDiagramId,
          past: [],
          future: [],
        }));
        fileSystemAdapter.setFolders(workspace.folders as any);
      } else {
        // No manifest: fall back to scanning diagrams only.
        const scan = await fileSystemAdapter.scanWorkspace();
        const validDiagrams = Object.fromEntries(scan.valid.map((d) => [d.id, d]));
        useDiagramStore.setState((s) => ({
          ...s,
          diagrams: validDiagrams as any,
          past: [],
          future: [],
        }));
      }
    } catch {
      setStatus("error");
    } finally {
      setSyncing(false);
    }
  }, []);

  const cancelDisconnect = useCallback(() => {
    setPendingDisconnect(false);
  }, []);

  return {
    status,
    folderName,
    connect,
    syncFromFolder,
    syncing,
    requestDisconnect,
    confirmDisconnectWithBackup,
    confirmDisconnectWithoutBackup,
    cancelDisconnect,
    pendingDisconnect,
    scanResult,
    pendingMerge,
    confirmMerge,
    confirmOverwrite,
    cancelMerge,
  };
}
