import { useShallow } from "zustand/react/shallow";
import type { IconDefinition } from "@/features/diagram";
import { useIconStore } from "../icons.store";

function sortIconDefinitions(icons: IconDefinition[]): IconDefinition[] {
  return [...icons].sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.name.localeCompare(b.name);
  });
}

export const useGlobalIconLibrary = () =>
  useIconStore(useShallow((state) => sortIconDefinitions(Object.values(state.icons))));

export const useGlobalIconById = (iconId: string) =>
  useIconStore(useShallow((state) => (iconId ? (state.icons[iconId] ?? null) : null)));
