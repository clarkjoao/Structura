import type { ReactNode } from "react";

export type JourneyPlayerMode =
  | { kind: "idle" }
  | { kind: "playing"; journeyId: string; selectedStepId: string }
  | { kind: "recording"; journeyId: string; targetStepId: string };

export interface JourneyRecordingTarget {
  journeyId: string;
  targetStepId: string;
  diagramId: string;
}

export interface JourneyPlaybackContext {
  journeyId: string;
  selectedStepId: string | null;
}

export interface JourneyPlayerState {
  mode: JourneyPlayerMode;
  /** Editor must call this so `startFlowPlayback` knows journey + step. */
  setPlaybackContext: (journeyId: string, selectedStepId: string | null) => void;
  selectStep: (stepId: string) => void;
  startFlowPlayback: (flowId: string, diagramId: string) => void;
  startRecording: (journeyId: string, stepId: string) => void;
  exit: () => void;
  /** While recording: completes flow recording (opens finalize flow in FlowMode). */
  finalizeJourneyRecording: () => void;
  /** Cancel in-progress recording and clear journey recording target (editor StepDetail). */
  cancelJourneyRecording: () => void;
}

export interface JourneyPlayerProviderProps {
  children: ReactNode;
}
