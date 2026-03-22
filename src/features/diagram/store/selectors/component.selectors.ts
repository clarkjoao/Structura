import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";
import { getCachedCanvasSnapshot } from "../../utils/snapshot-cache";

export const useComponentIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];
    const d = s.diagrams[s.activeDiagramId];
    return Object.keys(getCachedCanvasSnapshot(d).components);
  });

export const useComponent = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return getCachedCanvasSnapshot(d).components[id];
  });

export const useComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return getCachedCanvasSnapshot(d).components;
    }),
  );

export const useAllComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      return Object.values(getCachedCanvasSnapshot(d).components);
    }),
  );
