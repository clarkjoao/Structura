import { createContext, useContext } from "react";
import type { Flow } from "@/features/diagram";

export interface FlowPlaybackState {
  activeFlow: Flow | null;
  currentStep: number;
  isPlaying: boolean;
  play: (flow: Flow) => void;
  exit: () => void;
  prev: () => void;
  next: () => void;
  goToStep: (index: number) => void;
}

const noop = () => {};
const defaultState: FlowPlaybackState = {
  activeFlow: null,
  currentStep: 0,
  isPlaying: false,
  play: noop,
  exit: noop,
  prev: noop,
  next: noop,
  goToStep: noop,
};

const FlowPlaybackContext = createContext<FlowPlaybackState>(defaultState);

export const FlowPlaybackProvider = FlowPlaybackContext.Provider;

export function useFlowPlayback(): FlowPlaybackState {
  return useContext(FlowPlaybackContext);
}
