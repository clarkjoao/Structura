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

interface CollabSessionClosedModalProps {
  open: boolean;
  hostName: string;
  onImportAndContinue: () => void;
  onBackToWorkspace: () => void;
}

export function CollabSessionClosedModal({
  open,
  hostName,
  onImportAndContinue,
  onBackToWorkspace,
}: CollabSessionClosedModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mx-auto mb-2">
            <WifiOff className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-center">
            {t("collaboration.sessionEnded")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("collaboration.sessionEndedDesc", { host: hostName })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={onImportAndContinue} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            {t("collaboration.importAndContinue")}
          </Button>
          <Button
            variant="outline"
            onClick={onBackToWorkspace}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("collaboration.backToWorkspace")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
