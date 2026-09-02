import { useMemo } from "react";
import type { Flow } from "@/features/diagram";
import { buildFlowOutline, getBranchRows } from "@/features/diagram";
import { useFlowMode } from "./FlowModeContext";
import { useFlowViewStore } from "./useFlowViewStore";
import {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowHighlight,
  buildCoverage,
  buildFlowBadges,
} from "./flowState";

const EMPTY_HISTORY: string[] = [];

interface UseFlowStateParams {
  flows: Flow[];
  isCompareMode?: boolean;
}

export function useFlowState({ flows, isCompareMode = false }: UseFlowStateParams) {
  const flowMode = useFlowMode();
  const playbackState = flowMode.mode.kind === "playing" ? flowMode.mode : null;
  const activeFlow = playbackState?.flow ?? null;
  const currentStepId = playbackState?.currentStepId ?? null;
  const history = playbackState?.history ?? EMPTY_HISTORY;
  const { isPlaying, currentStep: activeStep, isRecording, recordingFlowId } = flowMode;
  const recordingContext = flowMode.recordingContext;

  const scriptFlowId = useFlowViewStore((state) => state.scriptFlowId);
  const numberedFlowId = recordingFlowId ?? scriptFlowId;
  const numberedFlow = useMemo(
    () => (numberedFlowId ? (flows.find((flow) => flow.id === numberedFlowId) ?? null) : null),
    [flows, numberedFlowId],
  );

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow || !currentStepId) return EMPTY_FLOW_HIGHLIGHT;
    return buildFlowHighlight(activeFlow, currentStepId, history);
  }, [isPlaying, activeFlow, currentStepId, history]);

  const coverage = useMemo(() => {
    if (isPlaying || isRecording || isCompareMode) return null;
    // Intentionally depends on full `flows`: coverage must refresh when steps mutate.
    return buildCoverage(flows);
  }, [flows, isPlaying, isRecording, isCompareMode]);

  /**
   * The rows the canvas is numbered from.
   *
   * One flow numbers the canvas at a time: the one whose script is open. Two
   * flows would put two unrelated numbers on the same node with nothing to
   * tell them apart. While recording that is the flow being recorded, and the
   * rows narrow to the branch in hand, so the canvas shows what the panel
   * shows. Outside a recording the numbers stay: they are derived from the
   * graph, not a thing the recorder puts there.
   */
  const flowBadges = useMemo(() => {
    if (!numberedFlow) return null;
    const outline = buildFlowOutline(numberedFlow);
    const rows =
      isRecording && recordingContext.mode === "branch-record"
        ? getBranchRows(outline, recordingContext.conditionStepId, recordingContext.branchIndex)
        : outline.rows;
    if (rows.length === 0) return null;
    return buildFlowBadges(numberedFlow, rows);
  }, [isRecording, numberedFlow, recordingContext]);

  return {
    isPlaying,
    activeStep,
    flowHighlight,
    coverage,
    flowBadges,
    activeFlow,
    currentStepId,
  };
}
