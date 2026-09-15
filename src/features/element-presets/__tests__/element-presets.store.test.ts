import { afterEach, describe, expect, it } from "vitest";
import type { ElementPreset } from "../types";
import {
  ELEMENT_PRESETS_ZUSTAND_KEY,
  LEGACY_CUSTOM_COMPONENTS_ZUSTAND_KEY,
  migrateZustandPresetStorageKey,
  useElementPresetStore,
} from "../store/element-presets.store";

function basePreset(overrides: Partial<ElementPreset> = {}): ElementPreset {
  return {
    id: "t1",
    name: "T",
    baseType: "system",
    data: {},
    templateVersion: 1,
    category: "general",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("element-presets store", () => {
  afterEach(() => {
    useElementPresetStore.setState({ presets: {} });
  });

  it("addPreset stores preset with templateVersion 1 when provided", () => {
    useElementPresetStore.getState().addPreset(basePreset({ templateVersion: 1 }));
    expect(useElementPresetStore.getState().presets.t1?.templateVersion).toBe(1);
  });

  it("updatePreset increments templateVersion", () => {
    useElementPresetStore.getState().addPreset(basePreset());
    useElementPresetStore.getState().updatePreset("t1", { name: "Renamed" });
    expect(useElementPresetStore.getState().presets.t1?.templateVersion).toBe(2);
    expect(useElementPresetStore.getState().presets.t1?.name).toBe("Renamed");
  });

  it("deletePreset removes the preset", () => {
    useElementPresetStore.getState().addPreset(basePreset());
    useElementPresetStore.getState().deletePreset("t1");
    expect(useElementPresetStore.getState().presets.t1).toBeUndefined();
  });

  it("getPresetById returns null for missing id", () => {
    expect(useElementPresetStore.getState().getPresetById("missing")).toBeNull();
  });

  it("normalizes empty category to general on add", () => {
    useElementPresetStore.getState().addPreset(basePreset({ id: "c", category: "   " }));
    expect(useElementPresetStore.getState().presets.c?.category).toBe("general");
  });

  it("normalizes invalid templateVersion to 1 on add", () => {
    useElementPresetStore.getState().addPreset(basePreset({ id: "v", templateVersion: 0 }));
    expect(useElementPresetStore.getState().presets.v?.templateVersion).toBe(1);
  });
});

describe("migrateZustandPresetStorageKey", () => {
  it("copies the legacy key into the new key once and removes the legacy entry", () => {
    const memory = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return memory.size;
      },
      clear: () => memory.clear(),
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
      key: (index) => [...memory.keys()][index] ?? null,
    };

    storage.setItem(
      LEGACY_CUSTOM_COMPONENTS_ZUSTAND_KEY,
      JSON.stringify({ state: { templates: { t1: basePreset() } }, version: 0 }),
    );

    expect(migrateZustandPresetStorageKey(storage)).toBe(true);
    expect(storage.getItem(ELEMENT_PRESETS_ZUSTAND_KEY)).toContain("t1");
    expect(storage.getItem(LEGACY_CUSTOM_COMPONENTS_ZUSTAND_KEY)).toBeNull();
  });

  it("is a no-op when there is no legacy key", () => {
    const memory = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return memory.size;
      },
      clear: () => memory.clear(),
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
      key: (index) => [...memory.keys()][index] ?? null,
    };

    expect(migrateZustandPresetStorageKey(storage)).toBe(false);
  });
});
