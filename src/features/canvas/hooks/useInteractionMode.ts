import { useMemo } from "react";
import { useFlowMode } from "../flow/FlowModeContext";
import { useCollab } from "@/features/collaboration";
import { isDiagramCompareMode, type Diagram, type DiagramModel } from "@/features/diagram";

export interface InteractionMode {
  isRecording: boolean;

  isPlaying: boolean;

  isFlowActive: boolean;

  isCompareMode: boolean;

  isCollabActive: boolean;

  isCollabGuest: boolean;

  canEditCanvas: boolean;

  canUseFlow: boolean;

  canStartCollab: boolean;

  canEditScenes: boolean;

  canExport: boolean;

  canNavigateDiagrams: boolean;
}

export function useInteractionMode(
  diagram: Diagram | DiagramModel | null | undefined,
): InteractionMode {
  const { isRecording, isPlaying } = useFlowMode();
  const { session, isGuest } = useCollab();

  const isCompareMode = isDiagramCompareMode(diagram);
  const isCollabActive = session !== null;
  const isCollabGuest = isGuest;
  const isFlowActive = isRecording || isPlaying;

  return useMemo((): InteractionMode => {
    const canEditCanvas = !isFlowActive && !isCompareMode;
    const canUseFlow = !isCollabActive;
    const canStartCollab = !isFlowActive;
    const canEditScenes = !isFlowActive;
    const canExport = !isFlowActive;
    const canNavigateDiagrams = !isFlowActive && !isCompareMode;

    return {
      isRecording,
      isPlaying,
      isFlowActive,
      isCompareMode,
      isCollabActive,
      isCollabGuest,
      canEditCanvas,
      canUseFlow,
      canStartCollab,
      canEditScenes,
      canExport,
      canNavigateDiagrams,
    };
  }, [isRecording, isPlaying, isFlowActive, isCompareMode, isCollabActive, isCollabGuest]);
}
