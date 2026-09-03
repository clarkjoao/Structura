import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FolderX, X, Save, Unplug, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface DisconnectConfirmDialogProps {
  folderName: string | null;
  /**
   * Number of diagrams currently saved in the browser (localStorage).
   * Drives the "browser backup" badge and changes the hint copy on the
   * destructive "Disconnect without saving" button so the user knows
   * whether they'll lose unsynced data.
   */
  localDiagramCount: number;
  /**
   * When true, all action buttons are disabled and show a spinner.
   * Disconnect operations flush the workspace to localStorage and may
   * take a few seconds on large folders.
   */
  isProcessing?: boolean;
  onKeepCopy: () => void;
  onDisconnectOnly: () => void;
  onCancel: () => void;
}

export function DisconnectConfirmDialog({
  folderName,
  localDiagramCount,
  isProcessing = false,
  onKeepCopy,
  onDisconnectOnly,
  onCancel,
}: DisconnectConfirmDialogProps) {
  const { t } = useTranslation();
  const hasLocalCopy = localDiagramCount > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm h-screen"
      onClick={isProcessing ? undefined : onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <FolderX className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("disconnect.title")}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {folderName
                ? t("disconnect.messageNamed", { name: folderName })
                : t("disconnect.messageGeneric")}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mb-4">{t("disconnect.explanation")}</p>

        {/* Browser backup status — tells the user at a glance whether they have
            a safety copy, and which hint variant to use below. */}
        <div
          className={`mb-4 flex items-start gap-2 text-[11px] rounded-md px-3 py-2 border ${
            hasLocalCopy
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-amber-400 bg-amber-400/10 border-amber-400/20"
          }`}
        >
          {hasLocalCopy ? (
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            <div className="font-medium">{t("disconnect.localCopyBadgeTitle")}</div>
            <div className="text-[10px] mt-0.5 opacity-90">
              {hasLocalCopy
                ? t("disconnect.localCopyBadgePresent", { count: localDiagramCount })
                : t("disconnect.localCopyBadgeMissing")}
            </div>
          </div>
        </div>

        {/* Action bar — buttons reordered from safest (left) to most destructive (right).
            Each action has a sub-line below explaining the concrete impact. */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-stretch gap-2">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 rounded-md border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              title={t("disconnect.cancelHint")}
            >
              <X className="h-3.5 w-3.5" />
              {t("common.cancel")}
            </button>
            <button
              onClick={onDisconnectOnly}
              disabled={isProcessing}
              className={`flex-1 rounded-md border px-3 py-2 text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 ${
                hasLocalCopy
                  ? "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  : "border-destructive/40 text-destructive hover:bg-destructive/10"
              }`}
              title={t("disconnect.disconnectOnlyHint")}
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="h-3.5 w-3.5" />
              )}
              {t("disconnect.disconnectOnly")}
            </button>
            <button
              onClick={onKeepCopy}
              disabled={isProcessing}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              title={t("disconnect.keepCopyTitle")}
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {t("disconnect.keepCopy")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground leading-snug">
            <p className="px-1">{t("disconnect.cancelHint")}</p>
            <p className={`px-1 ${hasLocalCopy ? "" : "text-destructive/80"}`}>
              {hasLocalCopy
                ? t("disconnect.disconnectOnlyHint")
                : t("disconnect.disconnectOnlyHintNoCopy")}
            </p>
            <p className="px-1">
              {hasLocalCopy
                ? t("disconnect.keepCopyHint", { count: localDiagramCount })
                : t("disconnect.keepCopyHintNoCopy")}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
