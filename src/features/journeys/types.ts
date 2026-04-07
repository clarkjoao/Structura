import type { ReactNode } from "react";

export interface JourneyStep {
  id: string;
  label: string;
  description?: string;
  duration?: string;
  order: number;
  diagramId: string;
  flowId?: string;
  svgContent?: string;
}

export interface Journey {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  tags: string[];
  steps: Record<string, JourneyStep>;
  createdAt: number;
  updatedAt: number;
}

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
  setPlaybackContext: (journeyId: string, selectedStepId: string | null) => void;
  selectStep: (stepId: string) => void;
  startFlowPlayback: (flowId: string, diagramId: string) => void;
  startRecording: (journeyId: string, stepId: string) => void;
  exit: () => void;
  finalizeJourneyRecording: () => void;
  cancelJourneyRecording: () => void;
}

export interface JourneyPlayerProviderProps {
  children: ReactNode;
}
