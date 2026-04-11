import { useMemo } from "react";
import { useFlows } from "@/features/diagram";
import { useJourneyPlayer, useJourneySteps } from "@/features/journeys";
import { useFlowMode } from "../flow/FlowModeContext";
import {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowHighlight,
} from "../flow/flowState";
import type { FlowHighlight } from "../flow/flowState";


export function useJourneyCanvasHighlight(): FlowHighlight {
  const journeyPlayer = useJourneyPlayer();
  const flows = useFlows();
  const flowMode = useFlowMode();

  const mode = journeyPlayer.mode;
  const journeyId = mode.kind === "playing" ? mode.journeyId : "";
  const selectedStepId = mode.kind === "playing" ? mode.selectedStepId : "";
  const steps = useJourneySteps(journeyId);

  return useMemo(() => {
    if (mode.kind !== "playing") {
      return EMPTY_FLOW_HIGHLIGHT;
    }
    const step = steps.find((item) => item.id === selectedStepId);
    if (!step?.flowId) {
      return EMPTY_FLOW_HIGHLIGHT;
    }
    const flow = flows.find((item) => item.id === step.flowId);
    if (!flow) {
      return EMPTY_FLOW_HIGHLIGHT;
    }

    const playing = flowMode.mode.kind === "playing" ? flowMode.mode : null;
    const sameFlow = playing?.flow.id === step.flowId;
    const entryId =
      flow.entryStepId && flow.steps[flow.entryStepId]
        ? flow.entryStepId
        : Object.keys(flow.steps)[0] ?? "";
    const currentStepId =
      sameFlow && playing?.currentStepId && flow.steps[playing.currentStepId]
        ? playing.currentStepId
        : entryId;
    if (!currentStepId || !flow.steps[currentStepId]) {
      return EMPTY_FLOW_HIGHLIGHT;
    }
    const history = sameFlow && playing?.history ? playing.history : [];
    return buildFlowHighlight(flow, currentStepId, history);
  }, [flowMode.mode, flows, mode.kind, selectedStepId, steps]);
}
