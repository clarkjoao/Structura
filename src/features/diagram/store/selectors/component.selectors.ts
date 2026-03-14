import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useComponentIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];

    return Object.keys(
      s.diagrams[s.activeDiagramId].snapshot.components,
    );
  });

export const useComponent = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;

    return s.diagrams[s.activeDiagramId]
      .snapshot.components[id];
  });

export const useComponents = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId].snapshot.components : {},
  );

export const useAllComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.components);
    }),
  );