import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useFlowIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];

    return Object.keys(
      s.diagrams[s.activeDiagramId].snapshot.flows,
    );
  });

export const useFlow = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;

    return s.diagrams[s.activeDiagramId]
      .snapshot.flows[id];
  });

export const useFlows = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.flows);
    }),
  );