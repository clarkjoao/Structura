import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface RenameDiagramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagram: Diagram | null;
  onSave: (name: string, description: string) => void;
}

export function RenameDiagramModal({
  open,
  onOpenChange,
  diagram,
  onSave,
}: RenameDiagramModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!diagram) return;
    setName(diagram.name);
    setDescription(diagram.description ?? "");
  }, [diagram]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    onSave(trimmedName, description.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("dashboard.renameModal.title")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("dashboard.renameModal.namePlaceholder")}
              autoFocus
            />

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                {t("dashboard.renameModal.descriptionLabel")}
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("dashboard.renameModal.descriptionPlaceholder")}
                className="min-h-24 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSave}>
              {t("dashboard.renameModal.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
