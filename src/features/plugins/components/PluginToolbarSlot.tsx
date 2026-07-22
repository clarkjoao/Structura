import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDiagramStore } from "@/features/diagram";
import type { PluginComponentPatch, PluginPanelContext, PluginServicePatch } from "../plugin.types";
import { usePluginPanels } from "../use-plugin-contributions";
import { sanitizeComponentPatch, sanitizeServicePatch } from "../snapshots";
import { PluginErrorBoundary } from "./PluginErrorBoundary";

interface PluginToolbarSlotProps {
  /** Must be "canvas-toolbar" */
  slot: "canvas-toolbar";
  /** Whether the user is in edit mode */
  isEditMode: boolean;
}

/** Host slot rendering plugin toolbar panels. */
export function PluginToolbarSlot({ slot, isEditMode }: PluginToolbarSlotProps) {
  const { t, i18n } = useTranslation();
  const panels = usePluginPanels(slot);
  const updateComponentAction = useDiagramStore((state) => state.updateComponent);
  const updateServiceAction = useDiagramStore((state) => state.updateService);

  // Unified PluginPanelContext (v1.2): the toolbar slot has no selection/service, but still
  // exposes the same sanctioned mutators so a component is typed identically across slots.
  const context: PluginPanelContext = useMemo(
    () => ({
      selection: [],
      service: null,
      updateComponent: (id: string, patch: PluginComponentPatch) => {
        updateComponentAction(id, sanitizeComponentPatch(patch));
      },
      updateService: (id: string, patch: PluginServicePatch) => {
        updateServiceAction(id, sanitizeServicePatch(patch));
      },
      locale: i18n.language,
      isEditMode,
    }),
    [i18n.language, isEditMode, updateComponentAction, updateServiceAction],
  );

  if (panels.length === 0) {
    return null;
  }

  const crashFallback = (
    <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
      {t("plugins.panel.crashed")}
    </span>
  );

  return (
    <>
      {panels.map((panel) => {
        const PanelComponent = panel.component;
        return (
          <PluginErrorBoundary key={panel.id} label="toolbar panel" fallback={crashFallback}>
            <PanelComponent context={context} />
          </PluginErrorBoundary>
        );
      })}
    </>
  );
}
