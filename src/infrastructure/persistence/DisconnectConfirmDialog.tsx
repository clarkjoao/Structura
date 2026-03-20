import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FolderX, Database } from "lucide-react";

interface DisconnectConfirmDialogProps {
  folderName: string | null;
  onKeepCopy: () => void;
  onDisconnectOnly: () => void;
  onCancel: () => void;
}

export function DisconnectConfirmDialog({
  folderName,
  onKeepCopy,
  onDisconnectOnly,
  onCancel,
}: DisconnectConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm h-screen"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <FolderX className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("disconnect.title")}</h2>
            <p className="text-[11px] text-muted-foreground">
              {folderName ? t("disconnect.messageNamed", { name: folderName }) : t("disconnect.messageGeneric")}
            </p>
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground mb-4">
          {t("disconnect.explanation")}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2 border-t border-border">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors order-last sm:order-first"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onDisconnectOnly}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {t("disconnect.disconnectOnly")}
          </button>
          <button
            onClick={onKeepCopy}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
            title={t("disconnect.keepCopyTitle")}
          >
            <Database className="h-3.5 w-3.5" />
            {t("disconnect.keepCopy")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
