import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Component } from "@/features/diagram";
import { useAllUserTemplates } from "@/features/diagram";
import { expandSelectionWithChildren } from "@/features/canvas/utils/capture-template";
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

export interface SaveTemplateModalProps {
  selectedComponentIds: string[];
  components: Record<string, Component>;
  onSave: (name: string, description: string, category: string) => void;
  onClose: () => void;
}

const TYPE_LABEL_KEY_BY_TYPE: Record<string, string> = {
  person: "multiSelect.typePerson",
  system: "multiSelect.typeSystem",
  container: "multiSelect.typeContainer",
  component: "multiSelect.typeComponent",
  panel: "multiSelect.typePanel",
  note: "multiSelect.typeNote",
};

export function SaveTemplateModal({
  selectedComponentIds,
  components,
  onSave,
  onClose,
}: SaveTemplateModalProps) {
  const { t } = useTranslation();
  const userTemplates = useAllUserTemplates();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const expandedIds = useMemo(
    () => expandSelectionWithChildren(selectedComponentIds, components),
    [selectedComponentIds, components],
  );

  const autoIncludedChildCount = useMemo(() => {
    const originallySelected = new Set(selectedComponentIds);
    return expandedIds.filter((id) => !originallySelected.has(id)).length;
  }, [expandedIds, selectedComponentIds]);

  const categorySuggestions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const template of userTemplates) {
      const value = template.category?.trim();
      if (value && !seen.has(value)) {
        seen.add(value);
        list.push(value);
      }
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [userTemplates]);

  const previewRows = useMemo(
    () =>
      expandedIds.map((id) => {
        const component = components[id];
        const typeKey = TYPE_LABEL_KEY_BY_TYPE[component?.type ?? ""];
        const typeLabel = component ? (typeKey ? t(typeKey) : component.type) : "";
        return {
          id,
          name: component?.name ?? id,
          typeLabel,
        };
      }),
    [expandedIds, components, t],
  );

  const canSave = name.trim().length > 0;

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (!canSave) return;
    onSave(name.trim(), description.trim(), category.trim());
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("saveTemplate.title")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="save-template-name">{t("common.name")}</Label>
              <Input
                id="save-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("saveTemplate.namePlaceholder")}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="save-template-description">{t("common.description")}</Label>
              <Input
                id="save-template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("saveTemplate.descriptionPlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="save-template-category">
                {t("saveTemplate.categoryPlaceholder")}
              </Label>
              <Input
                id="save-template-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t("saveTemplate.categoryPlaceholder")}
                list="save-template-category-suggestions"
              />
              <datalist id="save-template-category-suggestions">
                {categorySuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3">
              {autoIncludedChildCount > 0 ? (
                <p className="text-[11px] text-muted-foreground mb-2">
                  {t("saveTemplate.childrenIncluded", { count: autoIncludedChildCount })}
                </p>
              ) : null}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {t("saveTemplate.nodesIncluded", { count: previewRows.length })}
              </p>
              <ul className="max-h-36 space-y-1.5 overflow-y-auto text-sm">
                {previewRows.map((row) => (
                  <li key={row.id} className="flex justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{row.name}</span>
                    <span className="shrink-0 text-muted-foreground text-xs">{row.typeLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
