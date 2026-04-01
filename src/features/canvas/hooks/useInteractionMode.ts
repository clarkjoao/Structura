import { useMemo } from "react";
import { useFlowMode } from "../flow/FlowModeContext";
import { useCollab } from "@/features/collaboration";
import { isDiagramCompareMode, type Diagram } from "@/features/diagram";

/**
 * Centralized interaction mode — single source of truth for whether
 * canvas editing, flow features, collaboration, scene mutations and
 * export actions are available.
 *
 * Consumers should prefer the derived booleans (`canEditCanvas`, `canUseFlow`, …)
 * over combining raw flags themselves.
 */
export interface InteractionMode {
  /** Flow recorder is capturing steps. */
  isRecording: boolean;
  /** Flow is being played back (step-by-step). */
  isPlaying: boolean;
  /** Either recording or playing — any non-idle flow state. */
  isFlowActive: boolean;
  /** Two scenes are being compared side-by-side. */
  isCompareMode: boolean;
  /** A collaboration session is connected (host or guest). */
  isCollabActive: boolean;
  /** Current user joined as guest (read-only collaboration). */
  isCollabGuest: boolean;

  /** Canvas nodes/edges can be created, moved, deleted, edited. */
  canEditCanvas: boolean;
  /** Flow panel, recording and playback are accessible. */
  canUseFlow: boolean;
  /** Collaboration can be started. */
  canStartCollab: boolean;
  /** Scene create / delete / merge / switch actions are enabled. */
  canEditScenes: boolean;
  /** Export (draw.io, JSON, mermaid, etc.) is available. */
  canExport: boolean;
  /** Diagram navigation (sidebar, command palette, switch diagram) is available. */
  canNavigateDiagrams: boolean;
}

export function useInteractionMode(diagram: Diagram | null | undefined): InteractionMode {
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
