import type { Diagram } from "../../model/diagram.types";
import type { AppState } from "../store.types";


export function getActiveDiagram(state: AppState): Diagram | null {
  if (!state.activeDiagramId) return null;
  return state.diagrams[state.activeDiagramId] ?? null;
}
