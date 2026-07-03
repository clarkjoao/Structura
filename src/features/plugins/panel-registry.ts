import type { PanelContribution, PluginPanelSlot } from "./plugin.types";

/** Registry for plugin UI panels, keyed by contribution id, queried by host slot. */

const panels = new Map<string, PanelContribution>();
const listeners = new Set<() => void>();

let snapshot: PanelContribution[] = [];

function notifyChanged(): void {
  snapshot = [...panels.values()];
  for (const listener of listeners) listener();
}

export function registerPanelContribution(contribution: PanelContribution): void {
  if (panels.has(contribution.id)) {
    throw new Error(`[plugins] A panel with id "${contribution.id}" is already registered.`);
  }
  panels.set(contribution.id, contribution);
  notifyChanged();
}

export function unregisterPanelContribution(id: string): void {
  if (panels.delete(id)) notifyChanged();
}

/** Stable snapshot for useSyncExternalStore; new identity after every change. */
export function getPanelRegistrySnapshot(): PanelContribution[] {
  return snapshot;
}

export function subscribePanelRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPanelsForSlot(slot: PluginPanelSlot): PanelContribution[] {
  return snapshot.filter((panel) => panel.slot === slot);
}
