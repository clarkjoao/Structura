import { useMemo, useSyncExternalStore } from "react";
import type { ExporterContribution, ImporterContribution, PluginPanelSlot } from "./plugin.types";
import type { PanelContribution } from "./plugin.types";
import { getIoRegistrySnapshot, subscribeIoRegistry } from "./io-registry";
import { getPanelRegistrySnapshot, subscribePanelRegistry } from "./panel-registry";

/** Reactive list of plugin importers/exporters for import/export UI. */
export function usePluginIoContributions(): {
  importers: ImporterContribution[];
  exporters: ExporterContribution[];
} {
  return useSyncExternalStore(subscribeIoRegistry, getIoRegistrySnapshot);
}

/** Reactive list of plugin panels registered for a host slot. */
export function usePluginPanels(slot: PluginPanelSlot): PanelContribution[] {
  const panels = useSyncExternalStore(subscribePanelRegistry, getPanelRegistrySnapshot);
  return useMemo(() => panels.filter((panel) => panel.slot === slot), [panels, slot]);
}
