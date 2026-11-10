import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Level } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AddDiagramDialogProps } from "@/pages/dashboard/dashboard.types";

export function AddDiagramDialog({ onClose, onAdd }: AddDiagramDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("context");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dashboard.addDiagramTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("dashboard.addDiagramDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("common.name")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("dashboard.namePlaceholder")}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("common.c4Level")}
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="context">{t("dashboard.levelContext")}</option>
              <option value="container">{t("dashboard.levelContainer")}</option>
              <option value="component">{t("dashboard.levelComponent")}</option>
              <option value="deployment">{t("dashboard.levelDeployment")}</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("dashboard.domainOptional")}
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={t("dashboard.domainPlaceholder")}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("dashboard.createModal.descriptionLabel")}
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("dashboard.createModal.descriptionPlaceholder")}
              className="resize-none w-full min-h-20 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} size="sm">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              if (name.trim())
                onAdd(
                  name.trim(),
                  level,
                  domain.trim() || undefined,
                  description.trim() || undefined,
                );
            }}
            disabled={!name.trim()}
            size="sm"
          >
            {t("dashboard.createDiagram")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
