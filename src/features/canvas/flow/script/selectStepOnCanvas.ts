import type { FlowStep } from "@/features/diagram";
import { useCanvasSelectionStore } from "../../hooks/useCanvasSelectionStore";

/** Selects on the canvas what a step points at — the one selection the script and canvas share. */
export function selectStepOnCanvas(step: FlowStep | undefined): void {
  const selection = useCanvasSelectionStore.getState();
  if (step?.componentId) {
    selection.setSelectedNodeId(step.componentId);
    selection.setSelectedEdgeId(null);
    return;
  }
  if (step?.connectionId) {
    selection.setSelectedNodeId(null);
    selection.setSelectedNodeIds(new Set());
    selection.setSelectedEdgeId(step.connectionId);
  }
}
