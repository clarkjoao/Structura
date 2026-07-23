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
import { getBundledPlugins } from "./bundled-plugins";

/**
 * Install records, lifecycle state machine (install → activate → deactivate → uninstall)
 * and contribution ownership tracking (RFC D3). All persistence goes through IStoragePort
 * under the "plugins:installed" key — never part of the diagram persist schema.
 *
 * Two layers coexist: USER plugins (uploaded, persisted under "plugins:installed") and
 * BUNDLED plugins ("built-in" — compiled into the app bundle, re-derived from getBundledPlugins()
 * on every boot and never written to "plugins:installed"). Only the on/off choice for a bundled
 * plugin is persisted, as an id list under "plugins:bundled-disabled".
 */

export const PLUGIN_INSTALL_RECORDS_KEY = "plugins:installed";
export const PLUGIN_BUNDLED_DISABLED_KEY = "plugins:bundled-disabled";

export type PluginSource = "user" | "bundled";

export interface PluginRuntimeState {
  manifest: PluginManifest;
  enabled: boolean;
  errored: boolean;
  active: boolean;
  installedAt: number;
  /** "bundled" = shipped in this build (no uninstall); "user" = uploaded and persisted. */
  source: PluginSource;
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
/** Built-in plugins for this build. Ephemeral: re-derived from the bundle on every boot. */
let bundledRecords: PluginInstallRecord[] = [];
/** Ids of bundled plugins the user turned off. Persisted under PLUGIN_BUNDLED_DISABLED_KEY. */
let bundledDisabled = new Set<string>();
const activePlugins = new Map<string, ActivePlugin>();

const listeners = new Set<() => void>();
let stateSnapshot: PluginRuntimeState[] = [];

function toRuntimeState(record: PluginInstallRecord, source: PluginSource): PluginRuntimeState {
  return {
    manifest: record.manifest,
    enabled: record.enabled,
    errored: record.errored,
    active: activePlugins.has(record.manifest.id),
    installedAt: record.installedAt,
    source,
  };
}

function rebuildSnapshot(): void {
  // Bundled plugins first so the built-in layer reads as the app's baseline in the UI. User
  // records shadowed by a bundled id are hidden (kept in storage so they return if the built-in
  // is dropped from a later build) — see initializePluginRegistry.
  stateSnapshot = [
    ...bundledRecords.map((record) => toRuntimeState(record, "bundled")),
    ...records
      .filter((record) => !isBundledId(record.manifest.id))
      .map((record) => toRuntimeState(record, "user")),
  ];
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
  // Includes bundled ids so a user upload can never collide with a built-in plugin.
  return [...bundledRecords, ...records].map((record) => record.manifest.id);
}

function isBundledId(pluginId: string): boolean {
  return bundledRecords.some((record) => record.manifest.id === pluginId);
}

async function persistRecords(): Promise<void> {
  await storagePort.save(PLUGIN_INSTALL_RECORDS_KEY, records);
}

async function persistBundledDisabled(): Promise<void> {
  await storagePort.save(PLUGIN_BUNDLED_DISABLED_KEY, [...bundledDisabled]);
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
  // Bundled plugins ship with the build and cannot be uninstalled — only disabled.
  if (isBundledId(pluginId)) return;
  await deactivatePlugin(pluginId);
  records = records.filter((r) => r.manifest.id !== pluginId);
  await persistRecords();
  await deletePluginStorageNamespace(pluginId, storagePort);
  rebuildSnapshot();
}

/**
 * Enable or disable a bundled (built-in) plugin. Bundled plugins can't be uninstalled, so this
 * is the only user control over them; the choice is persisted as an id in the disabled set.
 */
export async function setBundledPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
  const record = bundledRecords.find((r) => r.manifest.id === pluginId);
  if (!record || record.enabled === enabled) return;
  record.enabled = enabled;

  if (enabled) {
    bundledDisabled.delete(pluginId);
    record.errored = false;
    try {
      await activateRecord(record);
    } catch (error) {
      console.error(`[plugins] re-enabling bundled "${pluginId}" failed:`, error);
      record.errored = true;
    }
  } else {
    bundledDisabled.add(pluginId);
    await deactivatePlugin(pluginId);
  }
  await persistBundledDisabled();
  rebuildSnapshot();
}

/**
 * Activate the built-in layer: run every bundled plugin from the app bundle (getBundledPlugins),
 * skipping ids the user disabled. Never persisted to "plugins:installed"; errors mark the record
 * errored for this session only and never break the app.
 */
async function initializeBundledPlugins(): Promise<void> {
  const disabledStored = await storagePort.load<string[]>(PLUGIN_BUNDLED_DISABLED_KEY);
  bundledDisabled = new Set(Array.isArray(disabledStored) ? disabledStored : []);
  bundledRecords = [];

  for (const { dir, code } of getBundledPlugins()) {
    let manifest: PluginManifest;
    try {
      const definition = executePluginCode(code);
      const validation = validatePluginManifest(definition.manifest, getInstalledPluginIds());
      if (!validation.ok) {
        console.error(`[plugins] bundled plugin "${dir}" has an invalid manifest, skipping.`);
        continue;
      }
      manifest = validation.manifest;
    } catch (error) {
      console.error(`[plugins] bundled plugin "${dir}" failed to load, skipping:`, error);
      continue;
    }

    const enabled = !bundledDisabled.has(manifest.id);
    const record: PluginInstallRecord = { manifest, code, enabled, errored: false, installedAt: 0 };
    bundledRecords.push(record);

    if (!enabled) continue;
    try {
      await activateRecord(record);
    } catch (error) {
      console.error(`[plugins] startup activation of bundled "${manifest.id}" failed:`, error);
      record.errored = true;
    }
  }
}

/**
 * App-boot entry: activate the built-in layer, then load persisted install records and
 * re-activate every enabled, non-errored user plugin (consent given at install persists,
 * RFC D3). Errors mark the plugin errored and never break the app.
 */
export async function initializePluginRegistry(port: IStoragePort = defaultStorage): Promise<void> {
  storagePort = port;

  // Built-in layer first, so its ids win over any colliding user record below.
  await initializeBundledPlugins();

  const stored = await port.load<PluginInstallRecord[]>(PLUGIN_INSTALL_RECORDS_KEY);
  records = Array.isArray(stored) ? stored : [];

  let recordsChanged = false;
  for (const record of records) {
    if (isBundledId(record.manifest.id)) {
      console.warn(
        `[plugins] user plugin "${record.manifest.id}" is shadowed by a built-in of the same id; skipping.`,
      );
      continue;
    }
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
  bundledRecords = [];
  bundledDisabled = new Set();
  storagePort = defaultStorage;
  rebuildSnapshot();
}
