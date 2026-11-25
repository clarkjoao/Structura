import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, AlertCircle, X, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSaveStatusStore,
  checkStorageHealth,
  clearNonEssentialStorage,
  shouldSuggestFolderSync,
} from "@/features/diagram";
import {
  isFileSystemSupported,
  requestConnectFolder,
  useFolderSyncStatus,
} from "@/infrastructure/persistence";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function StorageWarningBanner() {
  const { t } = useTranslation();
  const storageHealthLevel = useSaveStatusStore((state) => state.storageHealthLevel);
  const storageUsedBytes = useSaveStatusStore((state) => state.storageUsedBytes);
  const storageQuotaBytes = useSaveStatusStore((state) => state.storageQuotaBytes);
  // Read-only: the banner must not run the folder boot a second time (it used to call the whole
  // `useFileSystemStorage`, with a status of its own stuck at "disconnected").
  const { status: folderSyncStatus, folderName, lastWrite } = useFolderSyncStatus();
  const [dismissed, setDismissed] = useState(false);
  const [freedBytes, setFreedBytes] = useState<number | null>(null);

  if (storageHealthLevel === "ok") {
    return null;
  }

  const isCritical = storageHealthLevel === "critical";
  const isDanger = storageHealthLevel === "danger";
  // With a folder connected the work is saved there; the browser copy is only a backup. Nothing
  // asks to connect a folder, a near-full browser is not worth a banner, and a full one is news,
  // not an alarm.
  // Connected and receiving: a folder whose last write failed protects nothing until it succeeds.
  const folderConnected = folderSyncStatus === "connected" && lastWrite !== "failed";
  const folderFailing = folderSyncStatus === "connected" && lastWrite === "failed";
  const folderLost = folderSyncStatus === "needs_permission" || folderSyncStatus === "error";
  const suggestFolder = shouldSuggestFolderSync(storageHealthLevel, folderSyncStatus);

  // A folder that is connected (receiving or retrying) makes warning/danger moot: the indicator
  // reports a failing folder on its own.
  if (folderSyncStatus === "connected" && !isCritical) return null;
  // Only an unprotected workspace keeps the banner up: full with no folder, or a folder to connect.
  const dismissible = folderConnected || (!isCritical && !suggestFolder);
  if (dismissed && dismissible) return null;

  const handleClearStorage = () => {
    const freed = clearNonEssentialStorage();
    setFreedBytes(freed);
    void checkStorageHealth();
  };

  // Copy resolution: a connected folder first (the work is safe), then a folder to restore, then
  // the suggestion (warning/danger + disconnected), then the generic levels.
  let titleKey: string;
  let descKey: string;
  if (folderConnected) {
    titleKey = "storage.savedToFolder.title";
    descKey = "storage.savedToFolder.description";
  } else if (folderFailing) {
    titleKey = "storage.critical.title";
    descKey = "storage.folderFailing.description";
  } else if (folderLost && isCritical) {
    titleKey = "storage.critical.title";
    descKey = "storage.restoreFolder.description";
  } else if (suggestFolder && isDanger) {
    titleKey = "storage.urgentSuggest.title";
    descKey = "storage.urgentSuggest.description";
  } else if (suggestFolder) {
    titleKey = "storage.suggest.title";
    descKey = "storage.suggest.description";
  } else if (isCritical) {
    titleKey = "storage.critical.title";
    descKey = "storage.critical.description";
  } else if (isDanger) {
    titleKey = "storage.danger.title";
    descKey = "storage.danger.description";
  } else {
    titleKey = "storage.warning.title";
    descKey = "storage.warning.description";
  }
  const folderAction =
    !isFileSystemSupported || folderSyncStatus === "connected" || folderSyncStatus === "connecting"
      ? null
      : folderLost
        ? "storage.action.restoreFolder"
        : "storage.action.connectFolder";
  const tone = folderConnected ? "info" : isCritical ? "critical" : isDanger ? "danger" : "warning";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 px-4 py-3 text-sm border-b shrink-0",
        tone === "info" && "bg-muted/60 border-border text-foreground",
        tone === "critical" && "bg-destructive/10 border-destructive/30 text-destructive",
        tone === "danger" &&
          "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400",
        tone === "warning" &&
          "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
      )}
    >
      {tone === "critical" ? (
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium">{t(titleKey)}</p>
        <p className="text-xs opacity-80 mt-0.5">
          {t(descKey, {
            folder: folderName ?? "",
            used: formatBytes(storageUsedBytes),
            quota:
              storageQuotaBytes === null
                ? t("storage.localStorageQuota")
                : formatBytes(storageQuotaBytes),
          })}
        </p>
        {freedBytes !== null && freedBytes > 0 ? (
          <p className="text-xs font-medium mt-1">
            {t("storage.freed", { amount: formatBytes(freedBytes) })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-stretch gap-2 shrink-0 justify-end min-w-[200px]">
        {/* Clear-storage is suppressed when we're pushing folder sync as the
            primary CTA — two competing remediation paths would dilute the
            signal. The user can still clear manually from devtools. */}
        {!suggestFolder ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={handleClearStorage}
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            {t("storage.action.clear")}
          </Button>
        ) : null}
        {folderAction ? (
          <Button
            type="button"
            size="sm"
            className={cn("h-7 text-xs gap-1", suggestFolder && "w-full")}
            onClick={() => requestConnectFolder()}
          >
            <FolderOpen className="h-3 w-3" aria-hidden />
            {t(folderAction)}
          </Button>
        ) : null}
        {dismissible ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 self-end"
            onClick={() => setDismissed(true)}
            aria-label={t("common.dismiss")}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
