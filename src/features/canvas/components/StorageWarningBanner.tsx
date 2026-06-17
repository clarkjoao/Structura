import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, AlertCircle, X, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSaveStatusStore,
  checkStorageHealth,
  clearNonEssentialStorage,
} from "@/features/diagram";
import {
  isFileSystemSupported,
  requestConnectFolder,
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
  const [dismissed, setDismissed] = useState(false);
  const [freedBytes, setFreedBytes] = useState<number | null>(null);

  if (storageHealthLevel === "ok") {
    return null;
  }
  if (dismissed && storageHealthLevel !== "critical") {
    return null;
  }

  const isCritical = storageHealthLevel === "critical";
  const isDanger = storageHealthLevel === "danger";

  const handleClearStorage = () => {
    const freed = clearNonEssentialStorage();
    setFreedBytes(freed);
    checkStorageHealth();
  };

  const handleConnectFolder = () => {
    requestConnectFolder();
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 px-4 py-3 text-sm border-b shrink-0",
        isCritical && "bg-destructive/10 border-destructive/30 text-destructive",
        isDanger && "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400",
        !isCritical && !isDanger && "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
      )}
    >
      {isCritical ? (
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium">
          {isCritical
            ? t("storage.critical.title")
            : isDanger
              ? t("storage.danger.title")
              : t("storage.warning.title")}
        </p>
        <p className="text-xs opacity-80 mt-0.5">
          {isCritical
            ? t("storage.critical.description")
            : isDanger
              ? t("storage.danger.description", { used: formatBytes(storageUsedBytes) })
              : t("storage.warning.description", { used: formatBytes(storageUsedBytes) })}
        </p>
        {freedBytes !== null && freedBytes > 0 ? (
          <p className="text-xs font-medium mt-1">
            {t("storage.freed", { amount: formatBytes(freedBytes) })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
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
        {isFileSystemSupported ? (
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleConnectFolder}
          >
            <FolderOpen className="h-3 w-3" aria-hidden />
            {t("storage.action.connectFolder")}
          </Button>
        ) : null}
        {!isCritical ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
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
