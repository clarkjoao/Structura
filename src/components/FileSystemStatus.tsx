import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import {
  FolderOpen,
  FolderX,
  Loader2,
  HardDrive,
  Database,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { useLastFolderSync } from "@/hooks/useLastFolderSync";
import { useLastLocalStorageSync } from "@/hooks/useLastLocalStorageSync";
import {
  useFileSystemStorage,
  isFileSystemSupported,
} from "@/infrastructure/persistence/useFileSystemStorage";
import { registerConnectFolderRequestHandler } from "@/infrastructure/persistence/requestConnectFolder";
import { WorkspaceMergeDialog } from "@/infrastructure/persistence/WorkspaceMergeDialog";
import { DisconnectConfirmDialog } from "@/infrastructure/persistence/DisconnectConfirmDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDiagramStore } from "@/features/diagram";
import { useShallow } from "zustand/react/shallow";

export interface FileSystemStatusProps {
  compact?: boolean;
  hideActions?: boolean;
}

export function FileSystemStatus({ compact = false, hideActions = false }: FileSystemStatusProps = {}) {
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
    reconnectWithPermission,
    syncFromFolder,
    syncing,
    requestDisconnect,
    confirmDisconnectWithBackup,
    confirmDisconnectWithoutBackup,
    cancelDisconnect,
    pendingDisconnect,
    disconnectInProgress,
    scanResult,
    pendingMerge,
    mergeInProgress,
    overwriteInProgress,
    pushInProgress,
    confirmMerge,
    confirmOverwrite,
    confirmPushToEmptyFolder,
    cancelMerge,
  } = useFileSystemStorage();

  const isMergeDialogProcessing = mergeInProgress || overwriteInProgress || pushInProgress;

  useEffect(() => {
    registerConnectFolderRequestHandler(() => {
      void connect();
    });
    return () => registerConnectFolderRequestHandler(null);
  }, [connect]);

  const localDiagramCount = useDiagramStore(useShallow((s) => Object.keys(s.diagrams).length));

  return (
    <>
      {isFileSystemSupported && status === "connected" && !pendingMerge && (
        <div className="flex items-center gap-2">
          {compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled
                  className="flex h-8 w-8 items-center justify-center rounded-md
                    border border-emerald-500/30 bg-emerald-500/10 text-emerald-400
                    cursor-default"
                  aria-label={t("filesystem.localFolder")}
                >
                  <HardDrive className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {t("filesystem.localFolder")}
                    {folderName ? ` · ${folderName}` : ""}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {folderSyncCaption.text.trim()}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {t("filesystem.saveShortcutHint")}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
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
          )}
          {!hideActions && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={syncFromFolder}
                    disabled={syncing}
                    className="flex h-8 w-8 items-center justify-center rounded-md
                      text-muted-foreground hover:text-foreground hover:bg-muted/50
                      transition-colors disabled:opacity-50"
                    aria-label={t("filesystem.syncPullTitle")}
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  {t("filesystem.syncPullTitle")}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={requestDisconnect}
                    className="flex h-8 w-8 items-center justify-center rounded-md
                      text-muted-foreground hover:text-foreground hover:bg-muted/50
                      transition-colors"
                    aria-label={t("filesystem.disconnectTitle")}
                  >
                    <FolderX className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  {t("filesystem.disconnectTitle")}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      )}

      {isFileSystemSupported && status === "connecting" && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("filesystem.connecting")}
        </div>
      )}

      {isFileSystemSupported && status === "needs_permission" && !hideActions && (
        compact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={reconnectWithPermission}
                className="flex h-8 w-8 items-center justify-center rounded-md
                  border border-amber-500/40 bg-amber-500/10 text-amber-400
                  hover:bg-amber-500/20 hover:border-amber-500/60 transition-all"
                aria-label={t("filesystem.needsPermissionTitle")}
              >
                <KeyRound className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              {folderName
                ? t("filesystem.needsPermissionFolder", { name: folderName })
                : t("filesystem.needsPermissionLabel")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={reconnectWithPermission}
            className="flex items-center gap-1.5 rounded-md border border-amber-500/40
            bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400
            hover:bg-amber-500/20 hover:border-amber-500/60 transition-all"
            title={t("filesystem.needsPermissionTitle")}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            {folderName
              ? t("filesystem.needsPermissionFolder", { name: folderName })
              : t("filesystem.needsPermissionLabel")}
          </button>
        )
      )}

      {status === "disconnected" && (
        <div className="flex items-center gap-2">
          {compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled
                  className="flex h-8 w-8 items-center justify-center rounded-md
                    border border-amber-500/30 bg-amber-500/10 text-amber-400
                    cursor-default"
                  aria-label={t("filesystem.localStorageTitle")}
                >
                  <Database className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{t("filesystem.localStorageLabel")}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {localStorageSyncCaption.text.trim()}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
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
          )}
          {!hideActions &&
            isFileSystemSupported &&
            (compact ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={connect}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border
                      text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                    aria-label={t("filesystem.connectFolderTitle")}
                    title={t("filesystem.connectFolderTitle")}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  {t("filesystem.connectFolder")}
                </TooltipContent>
              </Tooltip>
            ) : (
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
            ))}
        </div>
      )}

      {!hideActions && pendingMerge && scanResult && (
        <WorkspaceMergeDialog
          scanResult={scanResult}
          localDiagramCount={localDiagramCount}
          isEmptyFolderPush={
            scanResult.valid.length === 0 &&
            scanResult.totalFilesScanned === 0 &&
            localDiagramCount > 0
          }
          isProcessing={isMergeDialogProcessing}
          onMerge={confirmMerge}
          onOverwriteLocal={confirmOverwrite}
          onConfirmEmptyFolderPush={confirmPushToEmptyFolder}
          onCancel={cancelMerge}
        />
      )}

      {!hideActions && pendingDisconnect && (
        <DisconnectConfirmDialog
          folderName={folderName}
          localDiagramCount={localDiagramCount}
          isProcessing={disconnectInProgress}
          onKeepCopy={confirmDisconnectWithBackup}
          onDisconnectOnly={confirmDisconnectWithoutBackup}
          onCancel={cancelDisconnect}
        />
      )}
    </>
  );
}
