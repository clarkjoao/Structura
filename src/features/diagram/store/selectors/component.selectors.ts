import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";
import { resolveCanvasSnapshot } from "../../utils/scene.utils";

export const useComponentIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];
    const d = s.diagrams[s.activeDiagramId];
    return Object.keys(resolveCanvasSnapshot(d).components);
  });

export const useComponent = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return resolveCanvasSnapshot(d).components[id];
  });

export const useComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return resolveCanvasSnapshot(d).components;
    }),
  );

export const useAllComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      return Object.values(resolveCanvasSnapshot(d).components);
    }),
  );
