import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus } from "lucide-react";
import type { Component, ComponentPatch } from "@/features/diagram";
import { useIconActions, useIconById } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";
import { IconPickerModal } from "@/features/canvas/components/icons/IconPickerModal";

export interface ComponentIconTabProps {
  component: Component;
  diagramId: string;
  updateComponent: (id: string, patch: ComponentPatch) => void;
}

export function ComponentIconTab({ component, diagramId, updateComponent }: ComponentIconTabProps) {
  const { t } = useTranslation();
  const { incrementIconUsage, decrementIconUsage } = useIconActions();
  const [pickerOpen, setPickerOpen] = useState(false);

  const customIconId = component.customIconId;
  const libraryIcon = useIconById(customIconId ?? "");

  const handlePickIcon = useCallback(
    (selectedIconId: string) => {
      if (!diagramId) return;
      const previousId = component.customIconId;
      if (selectedIconId === previousId) {
        setPickerOpen(false);
        return;
      }
      if (previousId) {
        decrementIconUsage(diagramId, previousId);
      }
      updateComponent(component.id, { customIconId: selectedIconId });
      incrementIconUsage(diagramId, selectedIconId);
      setPickerOpen(false);
    },
    [
      component.customIconId,
      component.id,
      decrementIconUsage,
      diagramId,
      incrementIconUsage,
      updateComponent,
    ],
  );

  const handleRemoveIcon = useCallback(() => {
    if (!diagramId || !component.customIconId) return;
    decrementIconUsage(diagramId, component.customIconId);
    updateComponent(component.id, { customIconId: undefined });
  }, [component.customIconId, component.id, decrementIconUsage, diagramId, updateComponent]);

  const canMutate = diagramId.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      {customIconId && libraryIcon ? (
        <>
          <div className="flex flex-col items-center gap-2">
            <CustomIconRenderer icon={libraryIcon} size={64} />
            <p className="max-w-full truncate text-center text-sm font-medium text-foreground">
              {libraryIcon.name}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canMutate}
              onClick={() => setPickerOpen(true)}
              className="w-full"
            >
              {t("icons.changeIcon")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canMutate}
              onClick={handleRemoveIcon}
              className="w-full"
            >
              {t("icons.removeIcon")}
            </Button>
          </div>
        </>
      ) : customIconId && !libraryIcon ? (
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs text-muted-foreground">{customIconId}</p>
          <Button
            type="button"
            variant="outline"
            disabled={!canMutate}
            onClick={handleRemoveIcon}
            className="w-full"
          >
            {t("icons.removeIcon")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <ImagePlus className="h-8 w-8 text-muted-foreground" strokeWidth={1.25} />
          </div>
          <Button
            type="button"
            disabled={!canMutate}
            onClick={() => setPickerOpen(true)}
            className="w-full max-w-xs"
          >
            {t("icons.addIcon")}
          </Button>
        </div>
      )}

      {pickerOpen && canMutate ? (
        <IconPickerModal
          diagramId={diagramId}
          currentIconId={customIconId}
          onSelect={handlePickIcon}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
