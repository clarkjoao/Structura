import type { CustomComponentTemplate } from "@/features/custom-components";

/**
 * Merges remote templates into local, keeping the newer `updatedAt` per id.
 */
export function mergeCustomComponentTemplates(
  local: Record<string, CustomComponentTemplate>,
  remote: Record<string, CustomComponentTemplate>,
): Record<string, CustomComponentTemplate> {
  const result = { ...local };
  for (const [id, remoteTemplate] of Object.entries(remote)) {
    const localTemplate = result[id];
    if (!localTemplate || remoteTemplate.updatedAt > localTemplate.updatedAt) {
      result[id] = remoteTemplate;
    }
  }
  return result;
}
