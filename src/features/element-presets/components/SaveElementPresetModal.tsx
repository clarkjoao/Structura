import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SaveElementPresetModalProps {
  defaultName: string;
  defaultDescription?: string;
  onSave: (name: string, description?: string) => void;
  onClose: () => void;
}

export function SaveElementPresetModal({
  defaultName,
  defaultDescription,
  onSave,
  onClose,
}: SaveElementPresetModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const canSave = name.trim().length > 0;

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (!canSave) return;
    onSave(name.trim(), description.trim() || undefined);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("elementPresets.saveAsPreset")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="element-preset-name">{t("common.name")}</Label>
            <Input
              id="element-preset-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="element-preset-description">{t("common.description")}</Label>
            <Input
              id="element-preset-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSave}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
