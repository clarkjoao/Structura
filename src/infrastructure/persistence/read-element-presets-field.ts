import type { ElementPreset } from "@/features/element-presets";

/**
 * Resolve presets from a workspace/manifest payload that may still use the
 * pre-F10 field name `customComponentTemplates`.
 */
export function readElementPresetsField(source: {
  elementPresets?: Record<string, ElementPreset>;
  customComponentTemplates?: Record<string, ElementPreset>;
}): Record<string, ElementPreset> | undefined {
  if (source.elementPresets && Object.keys(source.elementPresets).length > 0) {
    return source.elementPresets;
  }
  if (source.customComponentTemplates && Object.keys(source.customComponentTemplates).length > 0) {
    return source.customComponentTemplates;
  }
  return source.elementPresets ?? source.customComponentTemplates;
}
