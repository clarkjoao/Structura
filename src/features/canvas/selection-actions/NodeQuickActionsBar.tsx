import { useState, useCallback } from "react";
import { NodeToolbar, Position } from "@xyflow/react";
import { Lock, Unlock, ImagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentPatch } from "@/features/diagram";
import { useComponent, useIconActions } from "@/features/diagram";
import { IconPickerModal } from "@/features/canvas/components/icons/IconPickerModal";
import { OpacitySlider } from "./OpacitySlider";

interface NodeQuickActionsBarProps {
  nodeId: string;
  diagramId: string;
  updateComponent: (id: string, patch: ComponentPatch) => void;
}

export function NodeQuickActionsBar({
  nodeId,
  diagramId,
  updateComponent,
}: NodeQuickActionsBarProps) {
  const { t } = useTranslation();
  const component = useComponent(nodeId);
  const { incrementIconUsage, decrementIconUsage } = useIconActions();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleLockToggle = useCallback(() => {
    if (!component) return;
    updateComponent(nodeId, { locked: !component.locked });
  }, [component, nodeId, updateComponent]);

  const handleOpacityChange = useCallback(
    (value: number) => {
      updateComponent(nodeId, { panelOpacity: value });
    },
    [nodeId, updateComponent],
  );

  const handlePickIcon = useCallback(
    (selectedIconId: string) => {
      const previousId = component?.customIconId;
      if (selectedIconId === previousId) {
        setPickerOpen(false);
        return;
      }
      if (previousId) {
        decrementIconUsage(diagramId, previousId);
      }
      updateComponent(nodeId, { customIconId: selectedIconId });
      incrementIconUsage(diagramId, selectedIconId);
      setPickerOpen(false);
    },
    [
      component?.customIconId,
      decrementIconUsage,
      diagramId,
      incrementIconUsage,
      nodeId,
      updateComponent,
    ],
  );

  const handleResetIcon = useCallback(() => {
    if (!component?.customIconId) return;
    decrementIconUsage(diagramId, component.customIconId);
    updateComponent(nodeId, { customIconId: undefined });
  }, [
    component?.customIconId,
    decrementIconUsage,
    diagramId,
    nodeId,
    updateComponent,
  ]);

  if (!component) return null;

  const hasOpacity = "panelOpacity" in component;
  const hasIcon = "customIconId" in component;

  return (
    <>
      <NodeToolbar nodeId={nodeId} isVisible position={Position.Top} offset={10}>
        <div
          className="flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-1 shadow-lg"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Lock/unlock */}
          <button
            type="button"
            title={component.locked ? t("canvas.quickActions.unlock") : t("canvas.quickActions.lock")}
            aria-label={component.locked ? t("canvas.quickActions.unlock") : t("canvas.quickActions.lock")}
            onClick={handleLockToggle}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            {component.locked ? (
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Opacity slider — only for panel components */}
          {hasOpacity && (
            <div className="mx-1 border-l border-border pl-1">
              <OpacitySlider
                value={component.panelOpacity ?? 100}
                onChange={handleOpacityChange}
              />
            </div>
          )}

          {/* Icon picker — only for components that support icons */}
          {hasIcon && (
            <>
              <button
                type="button"
                title={t("canvas.quickActions.pickIcon")}
                aria-label={t("canvas.quickActions.pickIcon")}
                onClick={() => setPickerOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
              {component.customIconId && (
                <button
                  type="button"
                  title={t("canvas.quickActions.resetIcon")}
                  aria-label={t("canvas.quickActions.resetIcon")}
                  onClick={handleResetIcon}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <Unlock className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </NodeToolbar>

      {pickerOpen && diagramId ? (
        <IconPickerModal
          diagramId={diagramId}
          currentIconId={component.customIconId}
          onSelect={handlePickIcon}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </>
  );
}
