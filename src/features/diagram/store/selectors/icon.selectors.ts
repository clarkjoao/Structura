import { useShallow } from "zustand/react/shallow";
import { useIconStore } from "@/features/icons";
import type { IconDefinition } from "../../model/diagram.types";
import { getCachedCanvasSnapshot } from "../../utils/snapshot-cache";
import { useDiagramStore } from "../diagram.store";

function sortIconDefinitions(icons: IconDefinition[]): IconDefinition[] {
  return [...icons].sort((left, right) => {
    if (right.usageCount !== left.usageCount) {
      return right.usageCount - left.usageCount;
    }
    return left.name.localeCompare(right.name);
  });
}

export const useIconLibrary = () =>
  useIconStore(useShallow((state) => sortIconDefinitions(Object.values(state.icons))));

export const useIconById = (iconId: string) =>
  useIconStore(useShallow((state) => (iconId ? (state.icons[iconId] ?? null) : null)));

export const useComponentIcon = (componentId: string): IconDefinition | null => {
  const customIconId = useDiagramStore((state) => {
    if (!state.activeDiagramId || !componentId) {
      return null;
    }
    const diagram = state.diagrams[state.activeDiagramId];
    if (!diagram) {
      return null;
    }
    const component = getCachedCanvasSnapshot(diagram).components[componentId];
    return component?.customIconId ?? null;
  });

  const icon = useIconStore(
    useShallow((state) => (customIconId ? (state.icons[customIconId] ?? null) : null)),
  );

  return icon;
};
