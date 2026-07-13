import { useState, useCallback, useMemo } from "react";
import { NodeToolbar, Position } from "@xyflow/react";
import { Lock, Unlock, ImagePlus, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import type { ComponentPatch, Component } from "@/features/diagram";
import {
  useComponent,
  useIconActions,
  isNoteComponent,
  isC4Component,
  isPanelComponent,
} from "@/features/diagram";
import { getNotePresetPair } from "@/features/canvas/panels/ElementPanel/components/colorPresets";
import { IconPickerModal } from "@/features/canvas/components/icons/IconPickerModal";
import { OpacitySlider } from "./OpacitySlider";
import { ColorPicker, type ColorPickerGroup } from "./ColorPicker";

interface NodeQuickActionsBarProps {
  nodeId: string;
  diagramId: string;
  updateComponent: (id: string, patch: ComponentPatch) => void;
}

function pickColorGroup(component: Component | null): ColorPickerGroup | null {
  if (!component) return null;
  if (isNoteComponent(component)) return "note";
  if (isC4Component(component)) return "c4";
  if (isPanelComponent(component)) return "panel";
  return "vibrant";
}

function getCurrentColor(component: Component, isDark: boolean): string | undefined {
  if (isNoteComponent(component)) {
    return isDark ? component.panelColorDark : component.panelColor;
  }
  if (isC4Component(component)) {
    return (component as { panelColor?: string }).panelColor;
  }
  if (isPanelComponent(component)) {
    return component.panelColor;
  }
  return undefined;
}

export function NodeQuickActionsBar({
  nodeId,
  diagramId,
  updateComponent,
}: NodeQuickActionsBarProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const component = useComponent(nodeId);
  const { incrementIconUsage, decrementIconUsage } = useIconActions();
  const [pickerOpen, setPickerOpen] = useState(false);

  const colorGroup = pickColorGroup(component);
  const currentColor = useMemo(
    () => (component ? getCurrentColor(component, isDark) : undefined),
    [component, isDark],
  );

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

  const handleColorChange = useCallback(
    (color: string) => {
      if (!component) return;
      // Notes write BOTH light + dark when picking a preset pair
      if (isNoteComponent(component)) {
        const pair = getNotePresetPair(color);
        if (pair) {
          updateComponent(nodeId, {
            panelColor: pair.light,
            panelColorDark: pair.dark,
          });
          return;
        }
        // Custom color: write only current theme field
        updateComponent(nodeId, {
          [isDark ? "panelColorDark" : "panelColor"]: color,
        });
        return;
      }
      // Panels + C4: write panelColor
      updateComponent(nodeId, { panelColor: color });
    },
    [component, isDark, nodeId, updateComponent],
  );

  const handleColorReset = useCallback(() => {
    if (!component) return;
    if (isNoteComponent(component)) {
      updateComponent(nodeId, {
        panelColor: undefined,
        panelColorDark: undefined,
      });
      return;
    }
    updateComponent(nodeId, { panelColor: undefined });
  }, [component, nodeId, updateComponent]);

  if (!component) return null;

  const hasOpacity = "panelOpacity" in component;
  const hasIcon = "customIconId" in component;
  const hasColor = colorGroup !== null && (
    isNoteComponent(component) ||
    isC4Component(component) ||
    isPanelComponent(component)
  );

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

          {/* Color picker — only for note/c4/panel components */}
          {hasColor && (
            <div className="mx-1 border-l border-border pl-1">
              <ColorPicker
                group={colorGroup!}
                selectedColor={currentColor}
                onSelectColor={handleColorChange}
                onReset={handleColorReset}
              />
            </div>
          )}

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
                  <RotateCcw className="h-3.5 w-3.5" />
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