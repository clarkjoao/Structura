import { defaultStorage } from "./LocalStorageAdapter";
import type { IStoragePort } from "./IStoragePort";
import type { ElementPreset } from "@/features/element-presets";

/** IStoragePort key after F10 (adapter prefixes `structura_`). */
export const ELEMENT_PRESETS_STORAGE_KEY = "element_presets";
/** Pre-F10 IStoragePort key. */
export const LEGACY_CUSTOM_COMPONENTS_STORAGE_KEY = "custom_components";

/**
 * Persists the element-preset library through `IStoragePort`.
 *
 * On load, reads the new key first; if empty, copies from the legacy key once
 * and rewrites under the new key (F10).
 */
export class ElementPresetStore {
  constructor(private readonly storage: IStoragePort = defaultStorage) {}

  async save(presets: Record<string, ElementPreset>): Promise<void> {
    await this.storage.save(ELEMENT_PRESETS_STORAGE_KEY, presets);
  }

  async load(): Promise<Record<string, ElementPreset>> {
    const loaded = await this.storage.load<Record<string, ElementPreset>>(
      ELEMENT_PRESETS_STORAGE_KEY,
    );
    if (loaded && Object.keys(loaded).length > 0) return loaded;

    const legacy = await this.storage.load<Record<string, ElementPreset>>(
      LEGACY_CUSTOM_COMPONENTS_STORAGE_KEY,
    );
    if (!legacy || Object.keys(legacy).length === 0) return {};

    await this.storage.save(ELEMENT_PRESETS_STORAGE_KEY, legacy);
    return legacy;
  }
}

export const elementPresetStore = new ElementPresetStore();
