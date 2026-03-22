import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Folder } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface MoveDiagramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sortedFolders: Folder[];
  onSelectFolder: (event: MouseEvent, folderId: string | null) => void;
}

export function MoveDiagramDialog({
  open,
  onOpenChange,
  sortedFolders,
  onSelectFolder,
}: MoveDiagramDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(80vh,480px)] flex flex-col gap-0 p-0 overflow-hidden sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{t("dashboard.card.moveDialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 overflow-y-auto flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            className="justify-start font-normal"
            onClick={(event) => onSelectFolder(event, null)}
          >
            {t("dashboard.allDiagrams")}
          </Button>
          {sortedFolders.map((folder) => (
            <Button
              key={folder.id}
              type="button"
              variant="outline"
              className="justify-start font-normal"
              onClick={(event) => onSelectFolder(event, folder.id)}
            >
              {folder.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
