import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import type { Diagram, MergePreview, SceneDiff } from "@/features/diagram";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface MergeSceneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagram: Diagram;
  scene: SceneDiff;
  preview: MergePreview;
  onConfirm: () => void;
  onCancel: () => void;
}

function connectionLabel(diagram: Diagram, id: string): string {
  const c = diagram.snapshot.connections[id];
  if (!c) return id;
  const t = c.technology?.trim();
  const l = c.label?.trim();
  if (l && t) return `${l} (${t})`;
  return l || t || id;
}

export function MergeSceneDialog({
  open,
  onOpenChange,
  diagram,
  scene,
  preview,
  onConfirm,
  onCancel,
}: MergeSceneDialogProps) {
  const { t } = useTranslation();
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open, scene.id]);

  const addedCount = preview.componentsToAdd.length + preview.connectionsToAdd.length;
  const removedCount = preview.componentIdsToRemove.length + preview.connectionIdsToRemove.length;

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!acknowledged) return;
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle>{t("scenes.mergeDialogTitle", { name: scene.name })}</DialogTitle>
          <DialogDescription className="pt-2 text-left">
            {t("scenes.mergeDialogIrreversible")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(60vh,420px)] space-y-4 overflow-y-auto px-6 py-4 text-sm">
          <p className="text-muted-foreground">{t("scenes.mergeDialogIntro")}</p>

          {addedCount > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-500">
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                {t("scenes.mergeSectionAdded", { count: addedCount })}
              </h3>
              <ul className="space-y-1 pl-5 text-foreground">
                {preview.componentsToAdd.map((c) => (
                  <li key={c.id} className="flex gap-1">
                    <span className="text-emerald-600 dark:text-emerald-500">+</span>
                    <span>{c.name}</span>
                  </li>
                ))}
                {preview.connectionsToAdd.map((c) => (
                  <li key={c.id} className="flex gap-1">
                    <span className="text-emerald-600 dark:text-emerald-500">+</span>
                    <span>{c.label?.trim() || c.technology?.trim() || c.id}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {removedCount > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 font-medium text-rose-500 dark:text-rose-400">
                <Minus className="h-4 w-4 shrink-0" aria-hidden />
                {t("scenes.mergeSectionRemoved", { count: removedCount })}
              </h3>
              <ul className="space-y-1 pl-5 text-foreground">
                {preview.componentIdsToRemove.map((id) => (
                  <li key={id} className="flex gap-1">
                    <span className="text-rose-500 dark:text-rose-400">−</span>
                    <span>{diagram.snapshot.components[id]?.name ?? id}</span>
                  </li>
                ))}
                {preview.connectionIdsToRemove.map((id) => (
                  <li key={id} className="flex gap-1">
                    <span className="text-rose-500 dark:text-rose-400">−</span>
                    <span>{connectionLabel(diagram, id)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview.conflicts.length > 0 && (
            <section>
              <h3 className="mb-2 font-medium text-amber-600 dark:text-amber-500">
                {t("scenes.mergeSectionConflicts", { count: preview.conflicts.length })}
              </h3>
              <ul className="space-y-2 text-foreground">
                {preview.conflicts.map((c) => (
                  <li key={`${c.elementId}-${c.conflictingSceneId}`} className="flex gap-2">
                    <span className="shrink-0 text-amber-600 dark:text-amber-500" aria-hidden>
                      ⚡
                    </span>
                    <span>
                      {t("scenes.mergeConflictLine", {
                        element: c.elementName,
                        otherScene: c.conflictingSceneName,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="border-t border-border pt-3 text-muted-foreground">
            {t("scenes.mergeDialogSceneDeleted", { name: scene.name })}
          </p>

          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
            <Checkbox
              id="merge-ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label htmlFor="merge-ack" className="cursor-pointer text-left text-sm font-normal leading-snug">
              {t("scenes.mergeAcknowledge")}
            </Label>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t("scenes.mergeCancel")}
          </Button>
          <Button type="button" variant="default" disabled={!acknowledged} onClick={handleConfirm}>
            {t("scenes.mergeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
