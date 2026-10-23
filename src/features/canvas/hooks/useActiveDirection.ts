import { useDiagramStore, type DiagramDirection, type DiagramStore } from "@/features/diagram";

function directionOf(state: DiagramStore): DiagramDirection {
  const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
  return diagram?.direction ?? "LR";
}

/** The active diagram's reading direction (ADR-0013), as React state. */
export function useActiveDirection(): DiagramDirection {
  return useDiagramStore(directionOf);
}

/** The active diagram's reading direction, read once — for event handlers. */
export function activeDirection(): DiagramDirection {
  return directionOf(useDiagramStore.getState());
}
