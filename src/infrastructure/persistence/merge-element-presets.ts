import type { ElementPreset } from "@/features/element-presets";

/**
 * Merges remote presets into local, keeping the newer `updatedAt` per id.
 */
export function mergeElementPresets(
  local: Record<string, ElementPreset>,
  remote: Record<string, ElementPreset>,
): Record<string, ElementPreset> {
  const result = { ...local };
  for (const [id, remotePreset] of Object.entries(remote)) {
    const localPreset = result[id];
    if (!localPreset || remotePreset.updatedAt > localPreset.updatedAt) {
      result[id] = remotePreset;
    }
  }
  return result;
}
