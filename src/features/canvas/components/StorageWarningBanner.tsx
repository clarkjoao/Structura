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
  useFileSystemStorage,
} from "@/infrastructure/persistence";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StorageWarningBanner() {
  const { t } = useTranslation();
  const storageHealthLevel = useSaveStatusStore((state) => state.storageHealthLevel);
  const storageUsedBytes = useSaveStatusStore((state) => state.storageUsedBytes);
  const folderSyncStatus = useFileSystemStorage().status;
  const [dismissed, setDismissed] = useState(false);
  const [freedBytes, setFreedBytes] = useState<number | null>(null);

  if (storageHealthLevel === "ok") {
    return null;
  }

  const isCritical = storageHealthLevel === "critical";
  // Dismissal is only allowed when the user already has the suggested safety
  // net (folder sync connected) or for the critical branch (which is its own
  // catch-all and never dismissible by design).
  const suggestFolder = shouldSuggestFolderSync(storageHealthLevel, folderSyncStatus);
  const isDanger = storageHealthLevel === "danger";

  if (dismissed && !isCritical && !suggestFolder) {
    return null;
  }
  // In the danger branch the suggestion replaces the dismiss control entirely;
  // mirrors the critical branch's "no escape hatch" treatment.
  const showDismiss = !isCritical && !suggestFolder;

  const handleClearStorage = () => {
    const freed = clearNonEssentialStorage();
    setFreedBytes(freed);
    checkStorageHealth();
  };

  const handleConnectFolder = () => {
    requestConnectFolder();
  };

  // Copy resolution: suggestion copy (warning/danger + disconnected) wins over
  // the generic warning/danger copy because that's the point of the change.
  let titleKey: string;
  let descKey: string;
  if (suggestFolder && isDanger) {
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

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 px-4 py-3 text-sm border-b shrink-0",
        isCritical && "bg-destructive/10 border-destructive/30 text-destructive",
        !isCritical &&
          isDanger &&
          "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400",
        !isCritical &&
          !isDanger &&
          "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
      )}
    >
      {isCritical ? (
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium">{t(titleKey)}</p>
        <p className="text-xs opacity-80 mt-0.5">
          {t(descKey, { used: formatBytes(storageUsedBytes) })}
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
        {isFileSystemSupported ? (
          <Button
            type="button"
            size="sm"
            className={cn(
              "h-7 text-xs gap-1",
              suggestFolder && "w-full",
            )}
            onClick={handleConnectFolder}
          >
            <FolderOpen className="h-3 w-3" aria-hidden />
            {t("storage.action.connectFolder")}
          </Button>
        ) : null}
        {showDismiss ? (
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
