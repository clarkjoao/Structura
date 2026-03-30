import { useCollab } from "@/features/collaboration";
import { useFlowMode } from "../flow/FlowModeContext";

interface UseCanvasInteractionCapabilitiesParams {
  isCompareMode?: boolean;
}

/**
 * Shared interaction capability source for Flow + Collaboration mutual exclusion.
 */
export function useCanvasInteractionCapabilities({
  isCompareMode = false,
}: UseCanvasInteractionCapabilitiesParams = {}) {
  const { session } = useCollab();
  const { isPlaying, isRecording } = useFlowMode();

  const isCollaborationActive = session !== null;
  const isFlowInteractionLocked = isPlaying || isRecording;

  const canUseFlows = !isCollaborationActive;
  const canStartCollaboration = !isFlowInteractionLocked;

  const canEditCanvas = !isFlowInteractionLocked && !isCompareMode;
  const canSelectCanvasElements = canEditCanvas;

  return {
    isCollaborationActive,
    isFlowInteractionLocked,
    canUseFlows,
    canStartCollaboration,
    canEditCanvas,
    canSelectCanvasElements,
  };
}
