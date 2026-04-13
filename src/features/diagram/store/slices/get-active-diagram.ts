import type { Diagram } from "../../model/diagram.types";
import type { AppState } from "../store.types";


export function getActiveDiagram(state: AppState): Diagram | null {
  if (!state.activeDiagramId) return null;
  return state.diagrams[state.activeDiagramId] ?? null;
}

/** Marca o diagrama como modificado. Usar em todo slice que muta dados do diagrama. */
export function touchDiagram(d: Diagram): void {
  d.updatedAt = Date.now();
}
