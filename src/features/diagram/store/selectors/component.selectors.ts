import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";
import { getCachedCanvasSnapshot } from "../../utils/snapshot-cache";

const EMPTY_TAGS: string[] = [];

export const useComponentIds = () =>
  useDiagramStore(
    useShallow((state) => {
      if (!state.activeDiagramId) return [];
      const activeDiagram = state.diagrams[state.activeDiagramId];
      return Object.keys(getCachedCanvasSnapshot(activeDiagram).components);
    }),
  );

export const useComponent = (id: string) =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return undefined;
      const d = s.diagrams[s.activeDiagramId];
      return getCachedCanvasSnapshot(d).components[id];
    }),
  );

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

export const useDiagramTags = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return EMPTY_TAGS;
      const d = s.diagrams[s.activeDiagramId];
      const r = getCachedCanvasSnapshot(d);
      const tags = new Set<string>();
      for (const comp of Object.values(r.components)) {
        comp.tags?.forEach((tag) => tags.add(tag));
      }
      return [...tags].sort();
    }),
  );
