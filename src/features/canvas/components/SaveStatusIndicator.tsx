import { useTranslation } from "react-i18next";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useSaveStatusStore } from "@/features/diagram";
import { useFolderSyncStatus } from "@/infrastructure/persistence";

export function SaveStatusIndicator() {
  const { t } = useTranslation();
  const status = useSaveStatusStore((state) => state.status);
  const folder = useFolderSyncStatus();
  const folderConnected = folder.status === "connected";
  const folderFailed = folderConnected && folder.lastWrite === "failed";

  if (status === "pending") {
    return (
      <div
        className="flex items-center gap-1.5 select-none text-xs text-muted-foreground"
        aria-live="polite"
        aria-label={t("canvas.saving")}
      >
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        <span>{t("canvas.saving")}</span>
      </div>
    );
  }

  // The folder is where the work is meant to be: a failed folder write is said, whatever the
  // browser copy did (the sync tries again by itself).
  if (folderFailed) {
    return (
      <div
        className="flex items-center gap-1.5 select-none text-xs text-destructive"
        aria-live="polite"
        aria-label={t("canvas.folderSaveError")}
        title={t("canvas.folderSaveErrorHint")}
      >
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
        <span>{t("canvas.folderSaveError")}</span>
      </div>
    );
  }

  // The browser copy failed but the connected folder received the change: the work is saved,
  // only the backup is not. The storage banner says the rest.
  if (status === "error" && folderConnected) {
    return (
      <div
        className="flex items-center gap-1.5 select-none text-[11px] text-muted-foreground/70"
        aria-live="polite"
        aria-label={t("canvas.savedToFolder")}
      >
        <Check className="h-3 w-3 shrink-0 text-emerald-500/80" aria-hidden />
        <span>{t("canvas.savedToFolder")}</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex items-center gap-1.5 select-none text-xs text-destructive"
        aria-live="polite"
        aria-label={t("canvas.saveError")}
      >
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
        <span>{t("canvas.saveError")}</span>
      </div>
    );
  }

  // "idle" and "saved": quiet, persistent check + short label, low visual weight.
  return (
    <div
      className="flex items-center gap-1.5 select-none text-[11px] text-muted-foreground/70"
      aria-live="polite"
      aria-label={t("canvas.saved")}
    >
      <Check className="h-3 w-3 shrink-0 text-emerald-500/80" aria-hidden />
      <span>{t("canvas.saved")}</span>
    </div>
  );
}
