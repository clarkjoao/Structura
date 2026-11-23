import { useMemo, useSyncExternalStore } from "react";
import type { ExporterContribution, ImporterContribution, PluginPanelSlot } from "./plugin.types";
import type { PanelContribution } from "./plugin.types";
import {
  getIoRegistrySnapshot,
  subscribeIoRegistry,
  type RegisteredWorkspaceImporter,
} from "./io-registry";
import { getPanelRegistrySnapshot, subscribePanelRegistry } from "./panel-registry";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { appliesToDiagramKind } from "@/features/diagram-kinds/panel-scope";

/** Reactive list of plugin importers/exporters (and workspace importers) for import/export UI. */
export function usePluginIoContributions(): {
  importers: ImporterContribution[];
  exporters: ExporterContribution[];
  workspaceImporters: RegisteredWorkspaceImporter[];
} {
  return useSyncExternalStore(subscribeIoRegistry, getIoRegistrySnapshot);
}

/**
 * Reactive list of plugin panels registered for a host slot, for the active diagram: a panel
 * scoped with `appliesTo.kinds` (v1.16) shows only for those kinds.
 */
export function usePluginPanels(slot: PluginPanelSlot): PanelContribution[] {
  const panels = useSyncExternalStore(subscribePanelRegistry, getPanelRegistrySnapshot);
  const kind = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId]?.kind : undefined,
  );
  return useMemo(
    () =>
      panels.filter(
        (panel) => panel.slot === slot && appliesToDiagramKind(panel.appliesTo?.kinds, { kind }),
      ),
    [panels, slot, kind],
  );
}
