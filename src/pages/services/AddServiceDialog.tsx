import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ServiceDefinition } from "@/features/diagram";
import { AddByUrlView } from "./AddByUrlView";
import { ManualCreateForm } from "./ManualCreateForm";

type View = "url" | "manual";

interface AddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceDefinition[];
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
  onOpenExisting: (serviceId: string) => void;
}

/** Overlay for adding services; the list behind it does not move. */
export function AddServiceDialog({
  open,
  onOpenChange,
  services,
  onCreate,
  onOpenExisting,
}: AddServiceDialogProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("url");
  const close = () => onOpenChange(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setView("url");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-[680px] overflow-y-auto">
        <DialogTitle>{t("services.addServiceTitle")}</DialogTitle>
        {view === "url" && (
          <AddByUrlView
            services={services}
            onCreate={onCreate}
            onCancel={close}
            onManual={() => setView("manual")}
            onOpenExisting={onOpenExisting}
          />
        )}
        {view === "manual" && <ManualCreateForm onCancel={close} onCreate={onCreate} />}
      </DialogContent>
    </Dialog>
  );
}
