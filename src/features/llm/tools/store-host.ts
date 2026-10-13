import { getCachedCanvasSnapshot, useDiagramStore, type Diagram } from "@/features/diagram";
import type { DiagramToolHost } from "./host";

/** Reads the active diagram from the diagram store, as the canvas shows it. */
export function readActiveDiagram(): Diagram | null {
  const state = useDiagramStore.getState();
  const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
  if (!diagram) return null;
  const resolved = getCachedCanvasSnapshot(diagram);
  return {
    ...diagram,
    snapshot: {
      ...diagram.snapshot,
      components: resolved.components,
      connections: resolved.connections,
    },
  };
}

/** The host the chat uses when none is provided: read access through the store. */
export const storeDiagramHost: DiagramToolHost = { readDiagram: readActiveDiagram };
