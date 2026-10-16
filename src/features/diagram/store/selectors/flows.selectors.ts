import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useFlows = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.flows);
    }),
  );
