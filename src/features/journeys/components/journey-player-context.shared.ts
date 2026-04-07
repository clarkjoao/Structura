import { createContext } from "react";
import type { JourneyPlayerState } from "../types";

function createDefaultJourneyPlayerState(): JourneyPlayerState {
  return {
    mode: { kind: "idle" },
    setPlaybackContext: () => {},
    selectStep: () => {},
    startFlowPlayback: () => {},
    startRecording: () => {},
    exit: () => {},
    finalizeJourneyRecording: () => {},
    cancelJourneyRecording: () => {},
  };
}

export const JourneyPlayerReactContext = createContext<JourneyPlayerState>(
  createDefaultJourneyPlayerState(),
);
