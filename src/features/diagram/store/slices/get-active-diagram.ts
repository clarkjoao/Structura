import type { Diagram } from "../../model/diagram.types";
import type { AppState } from "../store.types";

/**
 * Retorna o diagrama ativo ou null se nao houver.
 * Usar no inicio de qualquer operacao que dependa de activeDiagramId.
 */
export function getActiveDiagram(state: AppState): Diagram | null {
  if (!state.activeDiagramId) return null;
  return state.diagrams[state.activeDiagramId] ?? null;
}
