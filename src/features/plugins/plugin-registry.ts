import type { IStoragePort } from "@/infrastructure/persistence";
import { defaultStorage } from "@/infrastructure/persistence";
import type { PluginDefinition, PluginInstallRecord, PluginManifest } from "./plugin.types";
import { validatePluginManifest, type ManifestValidationError } from "./manifest-validation";
import { executePluginCode, PluginLoadError } from "./plugin-loader";
import {
  createContributionTracker,
  createScopedPluginApi,
  rollbackContributions,
  type PluginContributionTracker,
} from "./plugin-api";
import { deletePluginStorageNamespace } from "./plugin-storage";

/**
 * Install records, lifecycle state machine (install → activate → deactivate → uninstall)
 * and contribution ownership tracking (RFC D3). All persistence goes through IStoragePort
 * under the "plugins:installed" key — never part of the diagram persist schema.
 */

export const PLUGIN_INSTALL_RECORDS_KEY = "plugins:installed";

export interface PluginRuntimeState {
  manifest: PluginManifest;
  enabled: boolean;
  errored: boolean;
  active: boolean;
  installedAt: number;
}

export type InstallPluginResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; reason: "load-error"; code: PluginLoadError["code"] }
  | { ok: false; reason: "invalid-manifest"; errors: ManifestValidationError[] }
  | { ok: false; reason: "activation-error"; manifest: PluginManifest };

interface ActivePlugin {
  tracker: PluginContributionTracker;
  deactivate?: () => void | Promise<void>;
}

let storagePort: IStoragePort = defaultStorage;
let records: PluginInstallRecord[] = [];
const activePlugins = new Map<string, ActivePlugin>();

const listeners = new Set<() => void>();
let stateSnapshot: PluginRuntimeState[] = [];

function rebuildSnapshot(): void {
  stateSnapshot = records.map((record) => ({
    manifest: record.manifest,
    enabled: record.enabled,
    errored: record.errored,
    active: activePlugins.has(record.manifest.id),
    installedAt: record.installedAt,
  }));
  for (const listener of listeners) listener();
}

export function subscribePluginRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for useSyncExternalStore; new identity after every change. */
export function getPluginRegistrySnapshot(): PluginRuntimeState[] {
  return stateSnapshot;
}

export function getInstalledPluginIds(): string[] {
  return records.map((record) => record.manifest.id);
}

async function persistRecords(): Promise<void> {
  await storagePort.save(PLUGIN_INSTALL_RECORDS_KEY, records);
}

async function activateFromDefinition(
  definition: PluginDefinition,
  manifest: PluginManifest,
): Promise<void> {
  const tracker = createContributionTracker();
  const api = createScopedPluginApi(manifest, tracker, storagePort);
  try {
    await definition.activate(api);
  } catch (error) {
    rollbackContributions(tracker);
    throw error;
  }
  activePlugins.set(manifest.id, { tracker, deactivate: definition.deactivate });
}

export type PreviewPluginResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; reason: "load-error"; code: PluginLoadError["code"] }
  | { ok: false; reason: "invalid-manifest"; errors: ManifestValidationError[] };

/**
 * First phase of the install flow: execute the picked file (picking it is consent to
 * execute, RFC D6) and validate the manifest, WITHOUT activating or persisting anything —
 * so the UI can display the declared capabilities before installation completes.
 */
export function previewPluginManifest(code: string): PreviewPluginResult {
  let definition: PluginDefinition;
  try {
    definition = executePluginCode(code);
  } catch (error) {
    if (error instanceof PluginLoadError) {
      return { ok: false, reason: "load-error", code: error.code };
    }
    throw error;
  }
  const validation = validatePluginManifest(definition.manifest, getInstalledPluginIds());
  if (!validation.ok) {
    return { ok: false, reason: "invalid-manifest", errors: validation.errors };
  }
  return { ok: true, manifest: validation.manifest };
}

/**
 * Install a plugin from explicitly user-picked file contents. Executing the file IS the
 * consent boundary (RFC D6); on any failure nothing is persisted and nothing stays
 * registered (plugin-system spec: containment).
 */
export async function installPluginFromCode(code: string): Promise<InstallPluginResult> {
  let definition: PluginDefinition;
  try {
    debugger;
    definition = executePluginCode(code);
  } catch (error) {
    if (error instanceof PluginLoadError) {
      return { ok: false, reason: "load-error", code: error.code };
    }
    throw error;
  }

  const validation = validatePluginManifest(definition.manifest, getInstalledPluginIds());
  if (!validation.ok) {
    return { ok: false, reason: "invalid-manifest", errors: validation.errors };
  }
  const manifest = validation.manifest;

  try {
    await activateFromDefinition(definition, manifest);
  } catch (error) {
    console.error(`[plugins] activate() of "${manifest.id}" failed during install:`, error);
    return { ok: false, reason: "activation-error", manifest };
  }

  records.push({ manifest, code, enabled: true, errored: false, installedAt: Date.now() });
  await persistRecords();
  rebuildSnapshot();
  return { ok: true, manifest };
}

/** Deactivate: best-effort plugin cleanup, then host-forced unregistration of everything. */
export async function deactivatePlugin(pluginId: string): Promise<void> {
  const active = activePlugins.get(pluginId);
  if (!active) return;
  activePlugins.delete(pluginId);
  try {
    await active.deactivate?.();
  } catch (error) {
    console.error(`[plugins] deactivate() of "${pluginId}" threw (ignored):`, error);
  }
  rollbackContributions(active.tracker);
  rebuildSnapshot();
}

async function activateRecord(record: PluginInstallRecord): Promise<void> {
  const definition = executePluginCode(record.code);
  await activateFromDefinition(definition, record.manifest);
}

export async function setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
  const record = records.find((r) => r.manifest.id === pluginId);
  if (!record || record.enabled === enabled) return;
  record.enabled = enabled;

  if (!enabled) {
    await deactivatePlugin(pluginId);
  } else {
    record.errored = false;
    try {
      await activateRecord(record);
    } catch (error) {
      console.error(`[plugins] re-enabling "${pluginId}" failed:`, error);
      record.errored = true;
    }
  }
  await persistRecords();
  rebuildSnapshot();
}

/** Uninstall: deactivate, delete the install record and the plugin's storage namespace. */
export async function uninstallPlugin(pluginId: string): Promise<void> {
  await deactivatePlugin(pluginId);
  records = records.filter((r) => r.manifest.id !== pluginId);
  await persistRecords();
  await deletePluginStorageNamespace(pluginId, storagePort);
  rebuildSnapshot();
}

/**
 * App-boot entry: load persisted install records and re-activate every enabled,
 * non-errored plugin (consent given at install persists, RFC D3). Errors mark the
 * plugin errored and never break the app.
 */
export async function initializePluginRegistry(port: IStoragePort = defaultStorage): Promise<void> {
  storagePort = port;
  const stored = await port.load<PluginInstallRecord[]>(PLUGIN_INSTALL_RECORDS_KEY);
  records = Array.isArray(stored) ? stored : [];

  let recordsChanged = false;
  for (const record of records) {
    if (!record.enabled || record.errored) continue;
    try {
      await activateRecord(record);
    } catch (error) {
      console.error(`[plugins] startup activation of "${record.manifest.id}" failed:`, error);
      record.errored = true;
      recordsChanged = true;
    }
  }
  if (recordsChanged) await persistRecords();
  rebuildSnapshot();
}

/** Test-only: drop all in-memory registry state (persisted data untouched). */
export async function resetPluginRegistryForTests(): Promise<void> {
  for (const pluginId of [...activePlugins.keys()]) {
    await deactivatePlugin(pluginId);
  }
  records = [];
  storagePort = defaultStorage;
  rebuildSnapshot();
}
