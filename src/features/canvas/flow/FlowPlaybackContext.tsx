import { createContext, useContext } from "react";
import type { Flow, FlowStep } from "@/features/diagram";

export interface FlowPlaybackState {
  activeFlow: Flow | null;
  currentStepId: string | null;
  currentStep: FlowStep | null;
  isPlaying: boolean;
  isCondition: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  history: string[];
  play: (flow: Flow) => void;
  exit: () => void;
  goBack: () => void;
  goNext: () => void;
  chooseBranch: (branchIndex: number) => void;
}

const noop = () => {};
const defaultState: FlowPlaybackState = {
  activeFlow: null,
  currentStepId: null,
  currentStep: null,
  isPlaying: false,
  isCondition: false,
  canGoBack: false,
  canGoForward: false,
  history: [],
  play: noop,
  exit: noop,
  goBack: noop,
  goNext: noop,
  chooseBranch: noop,
};

const FlowPlaybackContext = createContext<FlowPlaybackState>(defaultState);

export const FlowPlaybackProvider = FlowPlaybackContext.Provider;

export function useFlowPlayback(): FlowPlaybackState {
  return useContext(FlowPlaybackContext);
}
