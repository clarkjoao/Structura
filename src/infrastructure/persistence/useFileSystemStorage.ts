import { useState, useEffect, useCallback } from "react";
import { fileSystemAdapter } from "./FileSystemAdapter";
import type { WorkspaceScanResult } from "./FileSystemAdapter";
import { useDiagramStore } from "@/features/diagram";

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

  // Silent reconnect on mount
  useEffect(() => {
    if (!isFileSystemSupported) return;
    fileSystemAdapter.tryReconnect().then((ok) => {
      if (ok) {
        setStatus("connected");
        setFolderName(fileSystemAdapter.folderName);
        fileSystemAdapter.setFolders(useDiagramStore.getState().folders);
        fileSystemAdapter.loadWorkspace().then((workspace) => {
          if (workspace) {
            useDiagramStore.setState((s) => ({
              ...s,
              diagrams: { ...s.diagrams, ...workspace.diagrams },
              serviceRegistry: workspace.serviceRegistry as any,
              folders: workspace.folders as any,
            }));
            fileSystemAdapter.setFolders(workspace.folders as any);
          }
        });
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
      setStatus("connected");
      return;
    }

    if (scan.valid.length === 0) {
      // Folder has files but none are valid diagrams — just connect
      setStatus("connected");
      return;
    }

    // Folder has valid diagrams — show merge dialog
    setScanResult(scan);
    setPendingMerge(true);
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
    setScanResult(null);
    setPendingMerge(false);
  }, [scanResult]);

  const cancelMerge = useCallback(async () => {
    await fileSystemAdapter.disconnect();
    setScanResult(null);
    setPendingMerge(false);
    setStatus("disconnected");
    setFolderName(null);
  }, []);

  const disconnect = useCallback(async () => {
    await fileSystemAdapter.disconnect();
    setStatus("disconnected");
    setFolderName(null);
  }, []);

  return {
    status,
    folderName,
    connect,
    disconnect,
    scanResult,
    pendingMerge,
    confirmMerge,
    confirmOverwrite,
    cancelMerge,
  };
}
