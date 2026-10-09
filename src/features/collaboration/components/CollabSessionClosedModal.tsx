import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, WifiOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CollabEndReason } from "../types";
import { endReasonMessage } from "../utils/endReasonMessage";

interface CollabSessionClosedModalProps {
  open: boolean;
  hostName: string;
  reason: CollabEndReason | null;
  detail?: { size?: number; limit?: number } | null;
  /** Whether there is a local copy worth importing. */
  canImport: boolean;
  onImportAndContinue: () => void;
  onBackToWorkspace: () => void;
}

export function CollabSessionClosedModal({
  open,
  hostName,
  reason,
  detail,
  canImport,
  onImportAndContinue,
  onBackToWorkspace,
}: CollabSessionClosedModalProps) {
  const { t } = useTranslation();
  const hostCrashed = reason === "host_timeout";
  const title = hostCrashed ? t("collaboration.hostDisconnected") : t("collaboration.sessionEnded");
  const description = endReasonMessage(t, reason, detail, hostName);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mx-auto mb-2">
            <WifiOff className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          {canImport && (
            <Button onClick={onImportAndContinue} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {t("collaboration.importAndContinue")}
            </Button>
          )}
          <Button variant="outline" onClick={onBackToWorkspace} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("collaboration.backToWorkspace")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
