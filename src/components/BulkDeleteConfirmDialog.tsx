import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10">
            <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold text-foreground">
              {t("bulkDelete.title")}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              {t("bulkDelete.itemSummary", {
                diagrams: counts.diagrams,
                folders: counts.folders,
                services: counts.services,
              })}
            </DialogDescription>
          </div>
        </div>

        <p className="mb-6 text-[12px] leading-relaxed text-muted-foreground">
          {t("bulkDelete.warning")}
        </p>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onConfirm}>
            {t("bulkDelete.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
