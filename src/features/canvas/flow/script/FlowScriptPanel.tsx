import { useCallback, useEffect, useMemo } from "react";
import type { Flow } from "@/features/diagram";
import { buildFlowOutline } from "@/features/diagram";
import { useCanvasSelectionStore } from "../../hooks/useCanvasSelectionStore";
import { useFlowViewStore } from "../useFlowViewStore";
import { FlowScriptList } from "./FlowScriptList";

export interface FlowScriptPanelProps {
  flow: Flow;
  /** Recorder-only: jump into a condition's branches. */
  onOpenBranchSelect?: (conditionStepId: string) => void;
}

/**
 * The script panel, with its row selection tied to the canvas.
 *
 * One selection, not two: picking a row highlights what the step points at,
 * and picking that element on the canvas moves the panel to the row. The row
 * stays put while the canvas selection still matches it, so a flow that visits
 * the same node twice does not snap back to the first visit.
 */
export function FlowScriptPanel({ flow, onOpenBranchSelect }: FlowScriptPanelProps) {
  const selectedStepId = useFlowViewStore((state) => state.selectedStepId);
  const selectStep = useFlowViewStore((state) => state.selectStep);
  const selectedNodeId = useCanvasSelectionStore((state) => state.selectedNodeId);
  const selectedEdgeId = useCanvasSelectionStore((state) => state.selectedEdgeId);

  const outline = useMemo(() => buildFlowOutline(flow), [flow]);

  useEffect(() => {
    if (!selectedNodeId && !selectedEdgeId) return;
    const current = selectedStepId ? flow.steps[selectedStepId] : undefined;
    const alreadyMatches =
      current !== undefined &&
      ((selectedNodeId !== null && current.componentId === selectedNodeId) ||
        (selectedEdgeId !== null && current.connectionId === selectedEdgeId));
    if (alreadyMatches) return;
    const match = outline.rows.find((row) => {
      const step = flow.steps[row.stepId];
      if (!step) return false;
      if (selectedNodeId !== null && step.componentId === selectedNodeId) return true;
      return selectedEdgeId !== null && step.connectionId === selectedEdgeId;
    });
    selectStep(match?.stepId ?? null);
  }, [flow, outline, selectStep, selectedEdgeId, selectedNodeId, selectedStepId]);

  const onSelectStep = useCallback(
    (stepId: string) => {
      selectStep(stepId);
      const step = flow.steps[stepId];
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
    },
    [flow, selectStep],
  );

  return (
    <FlowScriptList
      flow={flow}
      selectedStepId={selectedStepId}
      onSelectStep={onSelectStep}
      onOpenBranchSelect={onOpenBranchSelect}
    />
  );
}
