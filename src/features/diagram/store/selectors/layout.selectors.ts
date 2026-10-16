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
