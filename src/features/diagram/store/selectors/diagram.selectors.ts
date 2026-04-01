import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useActiveDiagramId = () =>
  useDiagramStore((s) => s.activeDiagramId);

export const useActiveDiagram = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId] : null,
  );

export const useDiagramIds = () =>
  useDiagramStore(useShallow((s) => Object.keys(s.diagrams)));

export const useDiagram = (id: string) =>
  useDiagramStore((s) => s.diagrams[id]);

export const useDiagrams = () => useDiagramStore(useShallow((s) => s.diagrams));

export const useAllDiagrams = () =>
  useDiagramStore(
    useShallow((s) => Object.values(s.diagrams))
  );
