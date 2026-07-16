import { describe, expect, it } from "vitest";
import { getPresetsForProvider, MODEL_PRESETS } from "./model-presets";

describe("MODEL_PRESETS", () => {
  it("is a per-provider record with all three providers present", () => {
    expect(Object.keys(MODEL_PRESETS).sort()).toEqual(["anthropic", "custom", "openai"]);
  });

  it("exposes a curated list for openai with non-empty model ids", () => {
    const presets = MODEL_PRESETS.openai;
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      expect(preset.model.length).toBeGreaterThan(0);
      expect(preset.provider).toBe("openai");
    }
  });

  it("exposes a curated list for anthropic with non-empty model ids", () => {
    const presets = MODEL_PRESETS.anthropic;
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      expect(preset.model.length).toBeGreaterThan(0);
      expect(preset.provider).toBe("anthropic");
    }
  });

  it("does not include the deprecated o3-mini entry", () => {
    for (const preset of MODEL_PRESETS.openai) {
      expect(preset.model).not.toBe("o3-mini");
    }
  });

  it("custom provider is empty (presets are endpoint-specific)", () => {
    expect(MODEL_PRESETS.custom).toEqual([]);
  });

  it("getPresetsForProvider returns the same array for known providers", () => {
    expect(getPresetsForProvider("openai")).toBe(MODEL_PRESETS.openai);
    expect(getPresetsForProvider("anthropic")).toBe(MODEL_PRESETS.anthropic);
    expect(getPresetsForProvider("custom")).toEqual([]);
  });
});
