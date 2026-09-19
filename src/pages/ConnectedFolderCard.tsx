import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { FolderOpen } from "lucide-react";
import { useLastFolderSync } from "@/hooks/useLastFolderSync";
import { fileSystemAdapter } from "@/infrastructure/persistence/FileSystemAdapter";
import { isFileSystemSupported } from "@/infrastructure/persistence";
import { FOLDER_SYNCED_EVENT_NAME } from "@/infrastructure/persistence/folderSyncTimestamp";

/**
 * Compact connected-folder status for the workspace sidebar footer.
 * Reads the live adapter (same source as FileSystemStatus) without mounting
 * a second useFileSystemStorage instance — that hook owns boot/merge state
 * and must stay singular on the navbar.
 */
export function ConnectedFolderCard() {
  const { t, i18n } = useTranslation();
  const lastFolderSync = useLastFolderSync();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [connected, setConnected] = useState(() => fileSystemAdapter.isConnected);
  const [folderName, setFolderName] = useState(() => fileSystemAdapter.folderName);

  useEffect(() => {
    const refreshConnection = () => {
      setConnected(fileSystemAdapter.isConnected);
      setFolderName(fileSystemAdapter.folderName);
    };
    refreshConnection();
    const connectionInterval = window.setInterval(refreshConnection, 1_000);
    const nowInterval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    window.addEventListener(FOLDER_SYNCED_EVENT_NAME, refreshConnection);
    return () => {
      window.clearInterval(connectionInterval);
      window.clearInterval(nowInterval);
      window.removeEventListener(FOLDER_SYNCED_EVENT_NAME, refreshConnection);
    };
  }, []);

  const dateLocale = i18n.language.startsWith("pt") ? ptBR : enUS;

  const syncCaption = useMemo(() => {
    if (lastFolderSync === null) return t("filesystem.neverSynced");
    const ageMs = nowMs - lastFolderSync;
    if (ageMs < 10_000) return t("filesystem.syncNow");
    const timeStr = formatDistanceToNow(lastFolderSync, {
      addSuffix: true,
      locale: dateLocale,
    });
    return t("filesystem.syncAgo", { time: timeStr });
  }, [lastFolderSync, nowMs, t, dateLocale]);

  if (!isFileSystemSupported || !connected) return null;

  return (
    <div
      className="shrink-0 border-t border-sidebar-border p-2"
      data-testid="connected-folder-card"
    >
      <div className="flex items-start gap-2 rounded-md bg-muted px-2.5 py-2">
        <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {folderName ?? t("filesystem.localFolder")}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{syncCaption}</p>
        </div>
      </div>
    </div>
  );
}
