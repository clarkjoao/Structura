import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";
import { resolveSceneSnapshot } from "../../utils/scene.utils";

export const useComponentIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];
    const d = s.diagrams[s.activeDiagramId];
    return Object.keys(resolveSceneSnapshot(d, d.activeSceneId ?? null).components);
  });

export const useComponent = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return resolveSceneSnapshot(d, d.activeSceneId ?? null).components[id];
  });

export const useComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return resolveSceneSnapshot(d, d.activeSceneId ?? null).components;
    }),
  );

export const useAllComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      return Object.values(resolveSceneSnapshot(d, d.activeSceneId ?? null).components);
    }),
  );