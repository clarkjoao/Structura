import { useDiagramStore } from "../diagram.store";

export const useNodeLayouts = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return {};
    return s.diagrams[s.activeDiagramId].nodeLayouts;
  });

export const useNodeLayout = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    return s.diagrams[s.activeDiagramId].nodeLayouts[id];
  });