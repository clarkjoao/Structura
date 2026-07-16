import { useState, useCallback, useMemo } from "react";
import { NodeToolbar, Position } from "@xyflow/react";
import {
  Lock,
  Unlock,
  ImagePlus,
  RotateCcw,
  Group,
  Maximize2,
  LayoutGrid,
  Link2Off,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import type { ComponentPatch, Component } from "@/features/diagram";
import {
  useComponent,
  useIconActions,
  isNoteComponent,
  isC4Component,
  isPanelComponent,
  isEndpointComponent,
  isApiGroupComponent,
  isDbTableComponent,
  isJsonViewerComponent,
} from "@/features/diagram";
import { getNotePresetPair } from "@/features/canvas/panels/ElementPanel/components/colorPresets";
import { IconPickerModal } from "@/features/canvas/components/icons/IconPickerModal";
import { OpacityControl } from "./OpacityControl";
import { ColorPicker, type ColorPickerGroup } from "./ColorPicker";

interface NodeQuickActionsBarProps {
  nodeId: string;
  diagramId: string;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  /** Ungroup this panel — fired when toolbar button clicked. */
  onUngroup?: () => void;
  /** Resize panel to fit its children — toolbar button. */
  onFitToChildren?: () => void;
  /** Run auto-layout on panel children — toolbar button. */
  onOrganizeChildren?: () => void;
  /** Detach this child from its parent panel — toolbar button. */
  onRemoveFromGroup?: () => void;
}

function pickColorGroup(component: Component | null): ColorPickerGroup {
  if (!component) return "vibrant";
  if (isNoteComponent(component)) return "note";
  if (isC4Component(component)) return "c4";
  if (isPanelComponent(component)) return "panel";
  return "vibrant";
}

/**
 * Returns true if the component uses customColor instead of panelColor.
 * Components that don't have a dedicated color property use customColor.
 * Endpoints don't support color customization.
 */
function usesCustomColor(component: Component): boolean {
  // Endpoints don't support color
  if (isEndpointComponent(component)) return false;
  return !(
    isNoteComponent(component) ||
    isC4Component(component) ||
    isPanelComponent(component)
  );
}

/**
 * Returns true if the component supports color customization.
 * Used to show/hide the color picker in the quick actions bar.
 */
function supportsColor(component: Component): boolean {
  // Endpoints don't support color
  if (isEndpointComponent(component)) return false;
  return true;
}

function getCurrentColor(component: Component, isDark: boolean): string | undefined {
  if (usesCustomColor(component)) {
    return (component as { customColor?: string }).customColor;
  }
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
  onUngroup,
  onFitToChildren,
  onOrganizeChildren,
  onRemoveFromGroup,
}: NodeQuickActionsBarProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const component = useComponent(nodeId);
  const { incrementIconUsage, decrementIconUsage } = useIconActions();
  const [pickerOpen, setPickerOpen] = useState(false);

  const colorGroup = pickColorGroup(component ?? null);
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

  const handleOpacityReset = useCallback(() => {
    updateComponent(nodeId, { panelOpacity: undefined });
  }, [nodeId, updateComponent]);

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
      // Components that use customColor (cloud, unknown, etc.)
      if (usesCustomColor(component)) {
        updateComponent(nodeId, { customColor: color });
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
    // Components that use customColor
    if (usesCustomColor(component)) {
      updateComponent(nodeId, { customColor: undefined });
      return;
    }
    updateComponent(nodeId, { panelColor: undefined });
  }, [component, nodeId, updateComponent]);

  if (!component) return null;

  const hasOpacity = isPanelComponent(component);
  const hasIcon = "customIconId" in component;
  // Show color picker only for components that support color
  const hasColor = supportsColor(component);

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

          {/* Color picker — for all component types */}
          {hasColor && (
            <div className="mx-1 border-l border-border pl-1">
              <ColorPicker
                group={colorGroup}
                selectedColor={currentColor}
                onSelectColor={handleColorChange}
                onReset={handleColorReset}
              />
            </div>
          )}

          {/* Opacity control — only for panel components */}
          {hasOpacity && (
            <div className="mx-1 border-l border-border pl-1">
              <OpacityControl
                value={component.panelOpacity ?? 10}
                onChange={handleOpacityChange}
                onReset={handleOpacityReset}
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

          {/* Panel/group actions — only when applicable callbacks provided */}
          {(onUngroup || onFitToChildren || onOrganizeChildren) && (
            <div className="mx-1 border-l border-border pl-1 flex items-center gap-0.5">
              {onFitToChildren && (
                <button
                  type="button"
                  title={t("elementPanel.fitToChildren")}
                  aria-label={t("elementPanel.fitToChildren")}
                  onClick={onFitToChildren}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
              {onOrganizeChildren && (
                <button
                  type="button"
                  title={t("autoLayout.organizeChildren")}
                  aria-label={t("autoLayout.organizeChildren")}
                  onClick={onOrganizeChildren}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              )}
              {onUngroup && (
                <button
                  type="button"
                  title={t("endpointPanel.ungroup")}
                  aria-label={t("endpointPanel.ungroup")}
                  onClick={onUngroup}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <Group className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Remove from group — for children of panels */}
          {onRemoveFromGroup && (
            <div className="mx-1 border-l border-border pl-1">
              <button
                type="button"
                title={t("endpointPanel.removeFromGroup")}
                aria-label={t("endpointPanel.removeFromGroup")}
                onClick={onRemoveFromGroup}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <Link2Off className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </NodeToolbar>

      {pickerOpen && diagramId ? (
        <IconPickerModal
          diagramId={diagramId}
          currentIconId={component.customIconId}
          onSelect={handlePickIcon}
          onRemove={handleResetIcon}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </>
  );
}