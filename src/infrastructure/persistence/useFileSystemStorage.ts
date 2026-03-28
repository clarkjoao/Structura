import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { fileSystemAdapter } from "./FileSystemAdapter";
import type { WorkspaceScanResult } from "./FileSystemAdapter";
import { useDiagramStore } from "@/features/diagram";
import { useCustomComponentStore } from "@/features/custom-components/store";
import type { CustomComponentTemplate } from "@/features/custom-components/customComponent.types";
import {
  buildPersistStoragePayload,
  PERSIST_KEY,
} from "@/features/diagram/store/persist.config";
import { defaultStorage } from "./LocalStorageAdapter";
import {
  bootFileSystem,
  flushWorkspaceToConnectedFolder,
  resetBootState,
  startFileSystemSync,
} from "./fileSystemBoot";

async function clearLocalCache(): Promise<void> {
  await defaultStorage.delete(PERSIST_KEY);
}

export type FsStatus = "disconnected" | "connecting" | "connected" | "error";

export const isFileSystemSupported = "showDirectoryPicker" in globalThis;

function buildManifest(state: ReturnType<typeof useDiagramStore.getState>) {
  const customComponentTemplates = useCustomComponentStore.getState().templates;
  return {
    version: 1 as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    diagramIds: Object.keys(state.diagrams),
    serviceRegistry: state.serviceRegistry,
    folders: state.folders,
    activeDiagramId: state.activeDiagramId,
    customComponentTemplates,
  };
}

export function useFileSystemStorage() {
  const { t } = useTranslation();
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
    useCustomComponentStore.setState({ templates: {} });
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
        return;
      }

      defaultStorage.paused = false;

      queueMicrotask(async () => {
        const existing = await defaultStorage.getItem(PERSIST_KEY);
        if (existing !== null) return;

        const diagramCount = Object.keys(useDiagramStore.getState().diagrams).length;
        if (diagramCount === 0) return;

        const payload = buildPersistStoragePayload(useDiagramStore.getState());
        const written = await defaultStorage.forceSave(PERSIST_KEY, payload);
        if (!written) {
          console.warn("[Structura] Could not seed localStorage from in-memory diagrams (quota or blocked).");
        }
      });
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
    const manifest = scanResult.manifest;
    useDiagramStore.setState((s) => ({
      ...s,
      diagrams: { ...s.diagrams, ...validDiagrams },
      ...(manifest
        ? {
            folders: {
              ...s.folders,
              ...(manifest.folders as typeof s.folders),
            },
            serviceRegistry: {
              ...s.serviceRegistry,
              ...(manifest.serviceRegistry as typeof s.serviceRegistry),
            },
          }
        : {}),
    }));

    const manifestTemplates = manifest?.customComponentTemplates as
      | Record<string, CustomComponentTemplate>
      | undefined;
    if (manifestTemplates && Object.keys(manifestTemplates).length > 0) {
      useCustomComponentStore.setState((state) => ({
        templates: { ...state.templates, ...manifestTemplates },
      }));
    }

    const merged = useDiagramStore.getState();
    await flushWorkspaceToConnectedFolder(merged);

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
    const manifest = scanResult.manifest;
    useDiagramStore.setState((s) => ({
      ...s,
      diagrams: validDiagrams,
      ...(manifest
        ? {
            serviceRegistry: manifest.serviceRegistry as typeof s.serviceRegistry,
            folders: manifest.folders as typeof s.folders,
            activeDiagramId: manifest.activeDiagramId,
          }
        : {}),
    }));

    const manifestTemplates = manifest?.customComponentTemplates as
      | Record<string, CustomComponentTemplate>
      | undefined;
    if (manifestTemplates) {
      useCustomComponentStore.setState({ templates: manifestTemplates });
    }

    const overwritten = useDiagramStore.getState();
    await flushWorkspaceToConnectedFolder(overwritten);

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
      const customComponentTemplates = useCustomComponentStore.getState().templates;
      let payload: ReturnType<typeof buildPersistStoragePayload>;
      try {
        payload = buildPersistStoragePayload(state);
        JSON.stringify(payload);
      } catch {
        toast.error(t("filesystem.backupFailedSerialize"));
        setStatus("error");
        setPendingDisconnect(false);
        return;
      }

      const wrote = await defaultStorage.forceSave(PERSIST_KEY, payload);
      if (!wrote) {
        toast.error(t("filesystem.backupFailedQuota"));
        setStatus("error");
        setPendingDisconnect(false);
        return;
      }

      const saved = await defaultStorage.getItem(PERSIST_KEY);
      if (saved === null) {
        toast.error(t("filesystem.backupFailedVerify"));
        setStatus("error");
        setPendingDisconnect(false);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(saved) as unknown;
      } catch {
        toast.error(t("filesystem.backupFailedVerify"));
        setStatus("error");
        setPendingDisconnect(false);
        return;
      }

      const hasPersistShape =
        typeof parsed === "object" &&
        parsed !== null &&
        "state" in parsed &&
        typeof (parsed as { state: unknown }).state === "object" &&
        (parsed as { state: object | null }).state !== null;

      if (!hasPersistShape) {
        toast.error(t("filesystem.backupFailedVerify"));
        setStatus("error");
        setPendingDisconnect(false);
        return;
      }

      await performDisconnect();

      const after = useDiagramStore.getState();
      const flushPayload = buildPersistStoragePayload(after);
      const flushed = await defaultStorage.forceSave(PERSIST_KEY, flushPayload);
      if (!flushed) {
        toast.error(t("filesystem.backupFailedQuota"));
      }

      // Also backup custom-components (they're stored via localStorage persist + repository).
      await defaultStorage.forceSave("custom_components", customComponentTemplates);
    } catch {
      toast.error(t("filesystem.backupFailedGeneric"));
      setStatus("error");
      setPendingDisconnect(false);
    }
  }, [performDisconnect, t]);

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
          diagrams: workspace.diagrams as typeof s.diagrams,
          serviceRegistry: workspace.serviceRegistry as typeof s.serviceRegistry,
          folders: workspace.folders as typeof s.folders,
          activeDiagramId: workspace.activeDiagramId,
          past: [],
          future: [],
        }));
        fileSystemAdapter.setFolders(
          workspace.folders as unknown as ReturnType<typeof useDiagramStore.getState>["folders"],
        );

        const workspaceTemplates = workspace.customComponentTemplates;
        if (workspaceTemplates) {
          useCustomComponentStore.setState({ templates: workspaceTemplates });
        }
      } else {
        // No manifest: fall back to scanning diagrams only.
        const scan = await fileSystemAdapter.scanWorkspace();
        const validDiagrams = Object.fromEntries(scan.valid.map((d) => [d.id, d]));
        useDiagramStore.setState((s) => ({
          ...s,
          diagrams: validDiagrams as typeof s.diagrams,
          past: [],
          future: [],
        }));

        const scannedManifestTemplates = scan.manifest?.customComponentTemplates as
          | Record<string, CustomComponentTemplate>
          | undefined;
        if (scannedManifestTemplates) {
          useCustomComponentStore.setState({ templates: scannedManifestTemplates });
        }
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
