import type { Component, IconDefinition } from "@/features/diagram";
import { useIconStore } from "@/features/icons/store";

export function resolveUsedIconLibrary(
  components: Record<string, Component>,
): Record<string, IconDefinition> {
  const globalIcons = useIconStore.getState().icons;
  const result: Record<string, IconDefinition> = {};

  for (const comp of Object.values(components)) {
    const iconId = comp.customIconId;
    if (iconId && globalIcons[iconId]) {
      result[iconId] = globalIcons[iconId];
    }
  }

  return result;
}
