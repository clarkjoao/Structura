import { useShallow } from "zustand/react/shallow";
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
  useDiagramStore(
    useShallow((state) => {
      if (!state.activeDiagramId) return [];
      const diagram = state.diagrams[state.activeDiagramId];
      if (!diagram?.snapshot.iconLibrary) return [];
      return sortIconDefinitions(Object.values(diagram.snapshot.iconLibrary));
    }),
  );

export const useIconById = (iconId: string) =>
  useDiagramStore(
    useShallow((state) => {
      if (!state.activeDiagramId || !iconId) return null;
      const diagram = state.diagrams[state.activeDiagramId];
      return diagram?.snapshot.iconLibrary?.[iconId] ?? null;
    }),
  );

export const useComponentIcon = (componentId: string) =>
  useDiagramStore(
    useShallow((state) => {
      if (!state.activeDiagramId || !componentId) return null;
      const diagram = state.diagrams[state.activeDiagramId];
      if (!diagram) return null;
      const component = getCachedCanvasSnapshot(diagram).components[componentId];
      const customIconId = component?.customIconId;
      if (!customIconId) return null;
      return diagram.snapshot.iconLibrary?.[customIconId] ?? null;
    }),
  );
