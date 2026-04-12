import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { FolderOpen, FolderX, Loader2, HardDrive, Database, RefreshCw } from "lucide-react";
import { useLastFolderSync } from "@/hooks/useLastFolderSync";
import { useLastLocalStorageSync } from "@/hooks/useLastLocalStorageSync";
import {
  useFileSystemStorage,
  isFileSystemSupported,
} from "@/infrastructure/persistence/useFileSystemStorage";
import { registerConnectFolderRequestHandler } from "@/infrastructure/persistence/requestConnectFolder";
import { WorkspaceMergeDialog } from "@/infrastructure/persistence/WorkspaceMergeDialog";
import { DisconnectConfirmDialog } from "@/infrastructure/persistence/DisconnectConfirmDialog";
import { useDiagramStore } from "@/features/diagram";
import { useShallow } from "zustand/react/shallow";

export function FileSystemStatus() {
  const { t, i18n } = useTranslation();
  const lastFolderSync = useLastFolderSync();
  const lastLocalStorageSync = useLastLocalStorageSync();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const dateLocale = i18n.language.startsWith("pt") ? ptBR : enUS;

  const folderSyncCaption = useMemo(() => {
    if (lastFolderSync === null) {
      return {
        text: t("filesystem.neverSynced"),
        className: "text-[11px] text-muted-foreground ml-1.5",
      };
    }
    const ageMs = nowMs - lastFolderSync;
    if (ageMs < 10_000) {
      return {
        text: t("filesystem.syncNow"),
        className: "text-[11px] text-emerald-500 ml-1.5",
      };
    }
    const timeStr = formatDistanceToNow(lastFolderSync, {
      addSuffix: true,
      locale: dateLocale,
    });
    let tierClass = "text-[11px] text-muted-foreground ml-1.5";
    if (ageMs >= 2 * 60 * 60 * 1000) {
      tierClass = "text-[11px] text-destructive/70 ml-1.5";
    } else if (ageMs >= 30 * 60 * 1000) {
      tierClass = "text-[11px] text-amber-500 ml-1.5";
    }
    return {
      text: t("filesystem.syncAgo", { time: timeStr }),
      className: tierClass,
    };
  }, [lastFolderSync, nowMs, t, dateLocale]);

  const localStorageSyncCaption = useMemo(() => {
    if (lastLocalStorageSync === null) {
      return {
        text: t("localStorage.neverSynced"),
        className: "text-[11px] text-muted-foreground ml-1.5",
      };
    }
    const ageMs = nowMs - lastLocalStorageSync;
    if (ageMs < 10_000) {
      return {
        text: t("localStorage.syncNow"),
        className: "text-[11px] text-emerald-500 ml-1.5",
      };
    }
    const timeStr = formatDistanceToNow(lastLocalStorageSync, {
      addSuffix: true,
      locale: dateLocale,
    });
    let tierClass = "text-[11px] text-muted-foreground ml-1.5";
    if (ageMs >= 2 * 60 * 60 * 1000) {
      tierClass = "text-[11px] text-destructive/70 ml-1.5";
    } else if (ageMs >= 30 * 60 * 1000) {
      tierClass = "text-[11px] text-amber-500 ml-1.5";
    }
    return {
      text: t("localStorage.syncAgo", { time: timeStr }),
      className: tierClass,
    };
  }, [lastLocalStorageSync, nowMs, t, dateLocale]);

  const {
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
    confirmPushToEmptyFolder,
    cancelMerge,
  } = useFileSystemStorage();

  useEffect(() => {
    registerConnectFolderRequestHandler(() => {
      void connect();
    });
    return () => registerConnectFolderRequestHandler(null);
  }, [connect]);

  const localDiagramCount = useDiagramStore(
    useShallow((s) => Object.keys(s.diagrams).length)
  );

  return (
    <>
      {isFileSystemSupported && status === "connected" && !pendingMerge && (
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/30
            bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400"
            title={t("filesystem.saveShortcutHint")}
          >
            <HardDrive className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">{t("filesystem.localFolder")}</span>
            {folderName && (
              <span className="text-emerald-400/70 font-mono truncate max-w-[120px]">
                {folderName}
              </span>
            )}
            <span className={folderSyncCaption.className}>{folderSyncCaption.text}</span>
          </div>
          <button
            onClick={syncFromFolder}
            disabled={syncing}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title={t("filesystem.syncPullTitle")}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={requestDisconnect}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={t("filesystem.disconnectTitle")}
          >
            <FolderX className="h-4 w-4" />
          </button>
        </div>
      )}

      {isFileSystemSupported && status === "connecting" && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("filesystem.connecting")}
        </div>
      )}

      {status === "disconnected" && (
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-md border border-amber-500/30
              bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400"
            title={t("filesystem.localStorageTitle")}
          >
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">{t("filesystem.localStorageLabel")}</span>
            <span className={localStorageSyncCaption.className}>
              {localStorageSyncCaption.text}
            </span>
          </div>
          {isFileSystemSupported && (
            <button
              onClick={connect}
              className="flex items-center gap-1.5 rounded-md border border-border
              px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground
              hover:text-foreground hover:border-primary/40 transition-all"
              title={t("filesystem.connectFolderTitle")}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t("filesystem.connectFolder")}
            </button>
          )}
        </div>
      )}

      {pendingMerge && scanResult && (
        <WorkspaceMergeDialog
          scanResult={scanResult}
          localDiagramCount={localDiagramCount}
          isEmptyFolderPush={
            scanResult.valid.length === 0 && scanResult.totalFilesScanned === 0 && localDiagramCount > 0
          }
          onMerge={confirmMerge}
          onOverwriteLocal={confirmOverwrite}
          onConfirmEmptyFolderPush={confirmPushToEmptyFolder}
          onCancel={cancelMerge}
        />
      )}

      {pendingDisconnect && (
        <DisconnectConfirmDialog
          folderName={folderName}
          onKeepCopy={confirmDisconnectWithBackup}
          onDisconnectOnly={confirmDisconnectWithoutBackup}
          onCancel={cancelDisconnect}
        />
      )}
    </>
  );
}
