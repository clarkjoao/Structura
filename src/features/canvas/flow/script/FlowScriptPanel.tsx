import { useCallback, useEffect, useMemo } from "react";
import type { Flow } from "@/features/diagram";
import { buildFlowOutline } from "@/features/diagram";
import { useCanvasSelectionStore } from "../../hooks/useCanvasSelectionStore";
import { useFlowViewStore } from "../useFlowViewStore";
import { FlowScriptList, type ScriptRecording } from "./FlowScriptList";
import { selectStepOnCanvas } from "./selectStepOnCanvas";

export interface FlowScriptPanelProps {
  flow: Flow;
  /** Recorder-only: where the next click is written, and moving it. */
  recording?: ScriptRecording;
  /** Opens a step in its own panel, after selecting it on the canvas. */
  onOpenStep?: (stepId: string) => void;
}

/**
 * The script panel, with its row selection tied to the canvas.
 *
 * One selection, not two: picking a row highlights what the step points at,
 * and picking that element on the canvas moves the panel to the row. The row
 * stays put while the canvas selection still matches it, so a flow that visits
 * the same node twice does not snap back to the first visit.
 */
export function FlowScriptPanel({ flow, recording, onOpenStep }: FlowScriptPanelProps) {
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

  const onOpen = useCallback(
    (stepId: string) => {
      selectStep(stepId);
      onOpenStep?.(stepId);
      selectStepOnCanvas(flow.steps[stepId]);
    },
    [flow, onOpenStep, selectStep],
  );

  return (
    <FlowScriptList
      flow={flow}
      selectedStepId={selectedStepId}
      onOpenStep={onOpen}
      recording={recording}
    />
  );
}
