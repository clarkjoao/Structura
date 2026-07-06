import { useShallow } from "zustand/react/shallow";
import type { EdgeControlPoint } from "../../model/diagram.types";
import { useDiagramStore } from "../diagram.store";

const EMPTY_CONTROL_POINTS: EdgeControlPoint[] = [];

export const useEdgeControlPoints = (connectionId: string): EdgeControlPoint[] =>
  useDiagramStore(
    useShallow((state) => {
      const diagram = state.diagrams[state.activeDiagramId ?? ""];
      return diagram?.edgeLayouts[connectionId]?.points ?? EMPTY_CONTROL_POINTS;
    }),
  );

export const useEdgeLabelOffset = (connectionId: string): number | undefined =>
  useDiagramStore((state) => {
    const diagram = state.diagrams[state.activeDiagramId ?? ""];
    return diagram?.edgeLayouts[connectionId]?.labelOffset;
  });

const EMPTY_NODE_LAYOUTS: Record<string, import("../../model/diagram.types").NodeLayout> = {};

export const useNodeLayouts = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return EMPTY_NODE_LAYOUTS;
      return s.diagrams[s.activeDiagramId].nodeLayouts;
    }),
  );

export const useNodeLayout = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    return s.diagrams[s.activeDiagramId].nodeLayouts[id];
  });
