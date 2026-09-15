import { describe, expect, it } from "vitest";
import type { ElementPreset } from "@/features/element-presets";
import {
  ELEMENT_PRESETS_STORAGE_KEY,
  LEGACY_CUSTOM_COMPONENTS_STORAGE_KEY,
  ElementPresetStore,
} from "./elementPresetStore";
import { readElementPresetsField } from "./read-element-presets-field";
import { InMemoryAdapter } from "./InMemoryAdapter";

const sample: Record<string, ElementPreset> = {
  p1: {
    id: "p1",
    name: "API box",
    baseType: "container",
    data: { type: "container" },
    templateVersion: 1,
    createdAt: 1,
    updatedAt: 2,
  },
};

describe("ElementPresetStore load migrates the legacy IStoragePort key", () => {
  it("rewrites custom_components into element_presets", async () => {
    const memory = new InMemoryAdapter();
    await memory.save(LEGACY_CUSTOM_COMPONENTS_STORAGE_KEY, sample);

    const store = new ElementPresetStore(memory);
    const loaded = await store.load();
    expect(loaded).toEqual(sample);

    const underNewKey = await memory.load<Record<string, ElementPreset>>(
      ELEMENT_PRESETS_STORAGE_KEY,
    );
    expect(underNewKey).toEqual(sample);
  });
});

describe("readElementPresetsField", () => {
  it("prefers elementPresets when present", () => {
    expect(
      readElementPresetsField({
        elementPresets: sample,
        customComponentTemplates: { other: sample.p1 },
      }),
    ).toBe(sample);
  });

  it("falls back to customComponentTemplates", () => {
    expect(readElementPresetsField({ customComponentTemplates: sample })).toEqual(sample);
  });
});
