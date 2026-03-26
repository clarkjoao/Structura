import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface BulkDeleteCounts {
  diagrams: number;
  folders: number;
  services: number;
}

export interface BulkDeleteConfirmDialogProps {
  counts: BulkDeleteCounts;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkDeleteConfirmDialog({
  counts,
  onConfirm,
  onCancel,
}: BulkDeleteConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-[60] flex h-screen items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-title"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10">
            <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div className="min-w-0">
            <h2
              id="bulk-delete-title"
              className="text-sm font-semibold text-foreground"
            >
              {t("bulkDelete.title")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t("bulkDelete.itemSummary", {
                diagrams: counts.diagrams,
                folders: counts.folders,
                services: counts.services,
              })}
            </p>
          </div>
        </div>

        <p className="mb-6 text-[12px] leading-relaxed text-muted-foreground">
          {t("bulkDelete.warning")}
        </p>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
          >
            {t("bulkDelete.confirm")}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
