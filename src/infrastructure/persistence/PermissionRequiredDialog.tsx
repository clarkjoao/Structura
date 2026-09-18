import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { KeyRound, AlertTriangle, X, Unplug, Loader2, Database } from "lucide-react";

export type PermissionRequiredReason = "needs_permission" | "error";

interface PermissionRequiredDialogProps {
  folderName: string | null;
  reason: PermissionRequiredReason;
  isProcessing?: boolean;
  onReconnect: () => void;
  onContinueInBrowser: () => void;
  onDisconnect: () => void;
}

/**
 * Blocks the workspace when a previously connected folder needs a fresh
 * readwrite grant (boot) or when permission was revoked mid-session.
 * Sync is off until the user reconnects; dismissing keeps the toolbar chip.
 */
export function PermissionRequiredDialog({
  folderName,
  reason,
  isProcessing = false,
  onReconnect,
  onContinueInBrowser,
  onDisconnect,
}: PermissionRequiredDialogProps) {
  const { t } = useTranslation();
  const isLost = reason === "error";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm h-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-required-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
              isLost
                ? "bg-destructive/10 border-destructive/20"
                : "bg-amber-500/10 border-amber-500/20"
            }`}
          >
            {isLost ? (
              <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
            ) : (
              <KeyRound className="h-4.5 w-4.5 text-amber-500" />
            )}
          </div>
          <div>
            <h2 id="permission-required-title" className="text-sm font-semibold">
              {isLost
                ? t("filesystem.permissionModal.titleLost")
                : t("filesystem.permissionModal.titleBoot")}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {folderName
                ? t("filesystem.permissionModal.messageNamed", { name: folderName })
                : t("filesystem.permissionModal.messageGeneric")}
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-2 text-[11px] rounded-md px-3 py-2 border border-amber-500/20 bg-amber-500/10 text-amber-400">
          <Database className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>{t("filesystem.permissionModal.syncDisabledWarning")}</p>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={onContinueInBrowser}
              disabled={isProcessing}
              className="flex-1 rounded-md border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              title={t("filesystem.permissionModal.continueBrowserHint")}
            >
              <X className="h-3.5 w-3.5" />
              {t("filesystem.permissionModal.continueBrowser")}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={isProcessing}
              className="flex-1 rounded-md border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              title={t("filesystem.permissionModal.disconnectHint")}
            >
              <Unplug className="h-3.5 w-3.5" />
              {t("filesystem.permissionModal.disconnect")}
            </button>
            <button
              type="button"
              onClick={onReconnect}
              disabled={isProcessing}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              title={t("filesystem.permissionModal.reconnectHint")}
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              {t("filesystem.permissionModal.reconnect")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground leading-snug">
            <p className="px-1">{t("filesystem.permissionModal.continueBrowserHint")}</p>
            <p className="px-1">{t("filesystem.permissionModal.disconnectHint")}</p>
            <p className="px-1">{t("filesystem.permissionModal.reconnectHint")}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
