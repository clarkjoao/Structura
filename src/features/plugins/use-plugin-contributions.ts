import { useMemo, useSyncExternalStore } from "react";
import type { ExporterContribution, ImporterContribution, PluginPanelSlot } from "./plugin.types";
import type { PanelContribution } from "./plugin.types";
import {
  getIoRegistrySnapshot,
  subscribeIoRegistry,
  type RegisteredWorkspaceImporter,
} from "./io-registry";
import { getPanelRegistrySnapshot, subscribePanelRegistry } from "./panel-registry";

/** Reactive list of plugin importers/exporters (and workspace importers) for import/export UI. */
export function usePluginIoContributions(): {
  importers: ImporterContribution[];
  exporters: ExporterContribution[];
  workspaceImporters: RegisteredWorkspaceImporter[];
} {
  return useSyncExternalStore(subscribeIoRegistry, getIoRegistrySnapshot);
}

/** Reactive list of plugin panels registered for a host slot. */
export function usePluginPanels(slot: PluginPanelSlot): PanelContribution[] {
  const panels = useSyncExternalStore(subscribePanelRegistry, getPanelRegistrySnapshot);
  return useMemo(() => panels.filter((panel) => panel.slot === slot), [panels, slot]);
}
