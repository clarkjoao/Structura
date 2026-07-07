import type { ReactNode } from "react";

export interface WalkthroughStep {
  id: string;
  label: string;
  description?: string;
  duration?: string;
  order: number;
  diagramId: string;
  flowId?: string;
  svgContent?: string;
  mediaContent?: {
    type: "svg" | "image";
    data: string;
  };
}

export interface Walkthrough {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  tags: string[];
  steps: Record<string, WalkthroughStep>;
  createdAt: number;
  updatedAt: number;
}

export type WalkthroughPlayerMode =
  | { kind: "idle" }
  | { kind: "playing"; walkthroughId: string; selectedStepId: string }
  | { kind: "recording"; walkthroughId: string; targetStepId: string };

export interface WalkthroughRecordingTarget {
  walkthroughId: string;
  targetStepId: string;
  diagramId: string;
}

export interface WalkthroughPlaybackContext {
  walkthroughId: string;
  selectedStepId: string | null;
}

export interface WalkthroughPlayerState {
  mode: WalkthroughPlayerMode;
  setPlaybackContext: (walkthroughId: string, selectedStepId: string | null) => void;
  selectStep: (stepId: string) => void;
  startFlowPlayback: (flowId: string, diagramId: string) => void;
  startRecording: (walkthroughId: string, stepId: string) => void;
  exit: () => void;
  finalizeWalkthroughRecording: () => void;
  cancelWalkthroughRecording: () => void;
}

export interface WalkthroughPlayerProviderProps {
  children: ReactNode;
  onExitCanvas?: () => void;
}
