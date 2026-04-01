import { useShallow } from "zustand/react/shallow";
import type { Point } from "../../model/diagram.types";
import { useDiagramStore } from "../diagram.store";

/** Stable reference when a connection has no stored waypoints (avoids useSyncExternalStore infinite loops). */
const EMPTY_WAYPOINTS: Point[] = [];

export const useEdgeWaypoints = (connectionId: string): Point[] =>
  useDiagramStore(
    useShallow((state) => {
      const diagram = state.diagrams[state.activeDiagramId ?? ""];
      const waypoints = diagram?.edgeLayouts.find((layout) => layout.connectionId === connectionId)
        ?.waypoints;
      return waypoints ?? EMPTY_WAYPOINTS;
    }),
  );

export const useEdgeLabelOffset = (connectionId: string): number | undefined =>
  useDiagramStore((state) => {
    const diagram = state.diagrams[state.activeDiagramId ?? ""];
    return diagram?.edgeLayouts.find((layout) => layout.connectionId === connectionId)?.labelOffset;
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