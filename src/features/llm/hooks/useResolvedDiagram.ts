import { useMemo } from "react";
import { getCachedCanvasSnapshot, useActiveDiagramModel, type Diagram } from "@/features/diagram";

/** The active diagram as the canvas shows it (active version applied), for the composer menus. */
export function useResolvedDiagram(): Diagram | null {
  const model = useActiveDiagramModel();
  return useMemo(() => {
    if (!model) return null;
    const diagram: Diagram = { ...model, viewport: { x: 0, y: 0, zoom: 1 } };
    const resolved = getCachedCanvasSnapshot(diagram);
    return {
      ...diagram,
      snapshot: {
        ...diagram.snapshot,
        components: resolved.components,
        connections: resolved.connections,
      },
    };
  }, [model]);
}
