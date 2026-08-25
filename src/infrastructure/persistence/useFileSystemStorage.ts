import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { fileSystemAdapter } from "./FileSystemAdapter";
import type { WorkspaceScanResult } from "./FileSystemAdapter";
import { useDiagramStore } from "@/features/diagram";
import {
  useCustomComponentStore,
  type CustomComponentTemplate,
} from "@/features/custom-components";
import { useIconStore } from "@/features/icons";
import {
  buildPersistStoragePayload,
  flushDiagramStoreToLocalStorageNow,
  PERSIST_KEY,
} from "@/features/diagram";
import { defaultStorage } from "./LocalStorageAdapter";
import {
  clearLocalStorageDiagramSyncTimestamp,
  recordLocalStorageDiagramSyncSuccess,
} from "./localStorageSyncTimestamp";
import {
  bootFileSystem,
  flushWorkspaceToConnectedFolder,
  hydrateIconStoreFromWorkspace,
  awaitBootScan,
  resetBootState,
  startFileSystemSync,
} from "./fileSystemBoot";
import { mergeCustomComponentTemplates } from "./merge-custom-component-templates";
import { recordFolderSyncSuccess } from "./folderSyncTimestamp";
import { WORKSPACE_SCHEMA_VERSION as WORKSPACE_VERSION } from "./versions";

async function clearLocalCache(): Promise<void> {
  await defaultStorage.delete(PERSIST_KEY);
  clearLocalStorageDiagramSyncTimestamp();
}

export type FsStatus = "disconnected" | "connecting" | "connected" | "error" | "needs_permission";

export const isFileSystemSupported = "showDirectoryPicker" in globalThis;

function buildManifest(state: ReturnType<typeof useDiagramStore.getState>) {
  const customComponentTemplates = useCustomComponentStore.getState().templates;
  const iconLibrary = useIconStore.getState().icons;
  return {
    version: WORKSPACE_VERSION as 1 | 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    diagramIds: Object.keys(state.diagrams),
    serviceCatalog: state.serviceCatalog,
    folders: state.folders,
    activeDiagramId: state.activeDiagramId,
    customComponentTemplates,
    iconLibrary,
  };
}

export function useFileSystemStorage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<FsStatus>("disconnected");
  const [folderName, setFolderName] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<WorkspaceScanResult | null>(null);
  const [pendingMerge, setPendingMerge] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [overwriteInProgress, setOverwriteInProgress] = useState(false);
  const [pushInProgress, setPushInProgress] = useState(false);
  const [disconnectInProgress, setDisconnectInProgress] = useState(false);

  // Guard against double boot in React StrictMode
  const bootStartedRef = useRef(false);

  const clearStore = useCallback(() => {
    useDiagramStore.setState({
      diagrams: {},
      folders: {},
      serviceCatalog: {},
      activeDiagramId: null,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
      clipboard: null,
    });
    useCustomComponentStore.setState({ templates: {} });
  }, []);

  useEffect(() => {
    if (!isFileSystemSupported) return;
    // Guard against double boot in React StrictMode
    if (bootStartedRef.current) return;
    bootStartedRef.current = true;

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

      // Boot detected a conflict between in-memory state and the folder.
      // Surface it through the same modal as a fresh connect so the user
      // chooses explicitly (merge vs overwrite) instead of having the folder
      // overwritten silently.
      void (async () => {
        const conflictScan = await awaitBootScan();
        if (conflictScan) {
          setScanResult(conflictScan);
          setPendingMerge(true);
          setStatus("connected");
        }
      })();

      // Handle retrieved from IDB but awaiting a user-gesture to grant permission.
      if (fileSystemAdapter.needsPermission) {
        setStatus("needs_permission");
        setFolderName(fileSystemAdapter.pendingFolderName);
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
          console.warn(
            "[Structura] Could not seed localStorage from in-memory diagrams (quota or blocked).",
          );
        } else {
          recordLocalStorageDiagramSyncSuccess();
        }
      });
    });
  }, []);

  const reconnectWithPermission = useCallback(async () => {
    setStatus("connecting");
    const granted = await fileSystemAdapter.requestReconnectPermission();
    if (!granted) {
      setStatus("needs_permission");
      return;
    }

    defaultStorage.paused = true;
    fileSystemAdapter.setFolders(useDiagramStore.getState().folders);

    const workspace = await fileSystemAdapter.loadWorkspace();
    if (workspace) {
      const hydrated = hydrateIconStoreFromWorkspace(workspace);
      useDiagramStore.setState((s) => ({
        ...s,
        diagrams: hydrated.diagrams as typeof s.diagrams,
        serviceCatalog: workspace.serviceCatalog as typeof s.serviceCatalog,
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
        useCustomComponentStore.setState((state) => ({
          templates: mergeCustomComponentTemplates(state.templates, workspaceTemplates),
        }));
      }
    }

    await defaultStorage.delete(PERSIST_KEY);
    clearLocalStorageDiagramSyncTimestamp();

    setStatus("connected");
    setFolderName(fileSystemAdapter.folderName);
    startFileSystemSync();
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
      const diagramCount = Object.keys(useDiagramStore.getState().diagrams).length;
      if (diagramCount === 0) {
        const state = useDiagramStore.getState();
        fileSystemAdapter.setFolders(state.folders);
        for (const diagram of Object.values(state.diagrams)) {
          await fileSystemAdapter.writeDiagram(diagram);
        }
        await fileSystemAdapter.writeManifest(buildManifest(state));
        recordFolderSyncSuccess();
        defaultStorage.paused = true;
        await clearLocalCache();
        startFileSystemSync();
        setStatus("connected");
        return;
      }
      setScanResult(scan);
      setPendingMerge(true);
      setStatus("connected");
      return;
    }

    if (scan.valid.length === 0) {
      defaultStorage.paused = true;
      await clearLocalCache();
      startFileSystemSync();
      setStatus("connected");
      return;
    }

    setScanResult(scan);
    setPendingMerge(true);
    setStatus("connected");
  }, []);

  const confirmPushToEmptyFolder = useCallback(async () => {
    if (!scanResult || pushInProgress) return;
    setPushInProgress(true);
    try {
      // Backup the current in-memory state to localStorage BEFORE we touch the
      // store or the folder. If anything below fails, the user's existing
      // diagrams survive in the browser.
      const backupOk = await flushDiagramStoreToLocalStorageNow({ force: true });
      if (!backupOk) {
        toast.error(t("filesystem.backupFailedBeforePush"));
        return;
      }

      defaultStorage.paused = true;
      const state = useDiagramStore.getState();
      fileSystemAdapter.setFolders(state.folders);
      for (const diagram of Object.values(state.diagrams)) {
        await fileSystemAdapter.writeDiagram(diagram);
      }
      await fileSystemAdapter.writeManifest(buildManifest(state));
      recordFolderSyncSuccess();
      await clearLocalCache();
      startFileSystemSync();
      setScanResult(null);
      setPendingMerge(false);
      setStatus("connected");
    } catch (e) {
      console.error("[Structura] confirmPushToEmptyFolder failed:", e);
      toast.error(t("filesystem.pushFailedGeneric"));
    } finally {
      setPushInProgress(false);
    }
  }, [scanResult, pushInProgress, t]);

  const confirmMerge = useCallback(async () => {
    if (!scanResult || mergeInProgress) return;
    setMergeInProgress(true);
    try {
      // Backup current state BEFORE touching the store or the folder. The merge
      // path is non-destructive on its face, but the subsequent flush will
      // rewrite the manifest; if it fails partway, localStorage is our fallback.
      const backupOk = await flushDiagramStoreToLocalStorageNow({ force: true });
      if (!backupOk) {
        toast.error(t("filesystem.backupFailedBeforeMerge"));
        return;
      }

      defaultStorage.paused = true;
      const validDiagrams = Object.fromEntries(scanResult.valid.map((d) => [d.id, d]));
      const manifest = scanResult.manifest;
      useDiagramStore.setState((draft) => {
        draft.diagrams = { ...draft.diagrams, ...validDiagrams };
        if (manifest) {
          draft.folders = {
            ...draft.folders,
            ...(manifest.folders as typeof draft.folders),
          };
          draft.serviceCatalog = {
            ...draft.serviceCatalog,
            ...(manifest.serviceCatalog as typeof draft.serviceCatalog),
          };
        }
      });

      const manifestTemplates = manifest?.customComponentTemplates as
        Record<string, CustomComponentTemplate> | undefined;
      if (manifestTemplates) {
        useCustomComponentStore.setState((state) => ({
          templates: mergeCustomComponentTemplates(state.templates, manifestTemplates),
        }));
      }

      const hydratedMerge = hydrateIconStoreFromWorkspace({
        diagrams: useDiagramStore.getState().diagrams,
        iconLibrary: manifest?.iconLibrary,
      });
      useDiagramStore.setState((draft) => {
        draft.diagrams = hydratedMerge.diagrams as typeof draft.diagrams;
      });

      const merged = useDiagramStore.getState();
      const flushed = await flushWorkspaceToConnectedFolder(merged);

      if (!flushed) {
        // Flush failed — keep the modal open and leave localStorage holding the
        // pre-merge backup. The user can retry without losing their original work.
        toast.error(t("filesystem.mergeFailedFlush"));
        return;
      }

      await clearLocalCache();
      startFileSystemSync();
      setScanResult(null);
      setPendingMerge(false);
    } catch (e) {
      console.error("[Structura] confirmMerge failed:", e);
      toast.error(t("filesystem.mergeFailedGeneric"));
    } finally {
      setMergeInProgress(false);
    }
  }, [scanResult, mergeInProgress, t]);

  const confirmOverwrite = useCallback(async () => {
    if (!scanResult || overwriteInProgress) return;
    setOverwriteInProgress(true);
    try {
      // Backup BEFORE destroying anything. The overwrite path replaces the
      // in-memory store with folder data, so a pre-flush failure without this
      // backup would leave the user with neither their original work nor a
      // guaranteed fresh copy on disk.
      const backupOk = await flushDiagramStoreToLocalStorageNow({ force: true });
      if (!backupOk) {
        toast.error(t("filesystem.backupFailedBeforeOverwrite"));
        return;
      }

      defaultStorage.paused = true;
      const validDiagrams = Object.fromEntries(scanResult.valid.map((d) => [d.id, d]));
      const manifest = scanResult.manifest;
      useDiagramStore.setState((draft) => {
        draft.diagrams = validDiagrams;
        if (manifest) {
          draft.serviceCatalog = manifest.serviceCatalog as typeof draft.serviceCatalog;
          draft.folders = manifest.folders as typeof draft.folders;
          draft.activeDiagramId = manifest.activeDiagramId;
        }
      });

      const manifestTemplates = manifest?.customComponentTemplates as
        Record<string, CustomComponentTemplate> | undefined;
      if (manifestTemplates) {
        useCustomComponentStore.setState({ templates: manifestTemplates });
      }

      const hydratedOverwrite = hydrateIconStoreFromWorkspace({
        diagrams: useDiagramStore.getState().diagrams,
        iconLibrary: manifest?.iconLibrary,
      });
      useDiagramStore.setState((draft) => {
        draft.diagrams = hydratedOverwrite.diagrams as typeof draft.diagrams;
      });

      const overwritten = useDiagramStore.getState();
      const flushed = await flushWorkspaceToConnectedFolder(overwritten);

      if (!flushed) {
        // Flush failed (folder write or manifest write). Keep the modal open
        // and surface a toast — localStorage still holds the pre-overwrite
        // backup, so the user can dismiss and try again without losing data.
        toast.error(t("filesystem.overwriteFailedFlush"));
        return;
      }

      await clearLocalCache();
      startFileSystemSync();
      setScanResult(null);
      setPendingMerge(false);
    } catch (e) {
      console.error("[Structura] confirmOverwrite failed:", e);
      toast.error(t("filesystem.overwriteFailedGeneric"));
    } finally {
      setOverwriteInProgress(false);
    }
  }, [scanResult, overwriteInProgress, t]);

  const cancelMerge = useCallback(() => {
    // Just dismiss the modal — do NOT call disconnect() here. Disconnecting
    // wipes the folder handle from IndexedDB, forcing the user to pick the
    // folder again on the next session, and can strand in-memory diagrams
    // that haven't yet been flushed anywhere. The folder handle stays valid;
    // the user can reconnect by triggering an explicit disconnect from
    // FileSystemStatus (which shows the DisconnectConfirmDialog and offers
    // a localStorage backup first).
    setScanResult(null);
    setPendingMerge(false);
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
    if (disconnectInProgress) return;
    setDisconnectInProgress(true);
    try {
      // buildPersistStoragePayload / partialize omit clipboard; custom templates use a separate storage key.
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

      const wrote = await flushDiagramStoreToLocalStorageNow({ force: true });
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

      const flushed = await flushDiagramStoreToLocalStorageNow({ force: true });
      if (!flushed) {
        toast.error(t("filesystem.backupFailedQuota"));
      }

      await defaultStorage.forceSave("custom_components", customComponentTemplates);
    } catch {
      toast.error(t("filesystem.backupFailedGeneric"));
      setStatus("error");
      setPendingDisconnect(false);
    } finally {
      setDisconnectInProgress(false);
    }
  }, [performDisconnect, t, disconnectInProgress]);

  const confirmDisconnectWithoutBackup = useCallback(async () => {
    clearStore();
    await defaultStorage.delete(PERSIST_KEY);
    clearLocalStorageDiagramSyncTimestamp();
    await performDisconnect();
  }, [clearStore, performDisconnect]);

  const syncFromFolder = useCallback(async () => {
    if (!fileSystemAdapter.isConnected) return;
    setSyncing(true);
    try {
      const workspace = await fileSystemAdapter.loadWorkspace();
      if (workspace) {
        const hydratedWorkspace = hydrateIconStoreFromWorkspace(workspace);
        useDiagramStore.setState((s) => ({
          ...s,
          diagrams: hydratedWorkspace.diagrams as typeof s.diagrams,
          serviceCatalog: workspace.serviceCatalog as typeof s.serviceCatalog,
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
          useCustomComponentStore.setState((state) => ({
            templates: mergeCustomComponentTemplates(state.templates, workspaceTemplates),
          }));
        }
      } else {
        const scan = await fileSystemAdapter.scanWorkspace();
        const validDiagrams = Object.fromEntries(scan.valid.map((d) => [d.id, d]));

        const scannedManifestTemplates = scan.manifest?.customComponentTemplates as
          Record<string, CustomComponentTemplate> | undefined;
        if (scannedManifestTemplates) {
          useCustomComponentStore.setState((state) => ({
            templates: mergeCustomComponentTemplates(state.templates, scannedManifestTemplates),
          }));
        }

        const hydratedScan = hydrateIconStoreFromWorkspace({
          diagrams: validDiagrams,
          iconLibrary: scan.manifest?.iconLibrary,
        });
        useDiagramStore.setState((s) => ({
          ...s,
          diagrams: hydratedScan.diagrams as typeof s.diagrams,
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
    reconnectWithPermission,
    syncFromFolder,
    syncing,
    requestDisconnect,
    confirmDisconnectWithBackup,
    confirmDisconnectWithoutBackup,
    cancelDisconnect,
    pendingDisconnect,
    scanResult,
    pendingMerge,
    mergeInProgress,
    overwriteInProgress,
    pushInProgress,
    disconnectInProgress,
    confirmMerge,
    confirmOverwrite,
    confirmPushToEmptyFolder,
    cancelMerge,
  };
}
