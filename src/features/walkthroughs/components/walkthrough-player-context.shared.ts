import { createContext } from "react";
import type { WalkthroughPlayerState } from "../types";

function createDefaultWalkthroughPlayerState(): WalkthroughPlayerState {
  return {
    mode: { kind: "idle" },
    setPlaybackContext: () => {},
    selectStep: () => {},
    startFlowPlayback: () => {},
    startRecording: () => {},
    exit: () => {},
    finalizeWalkthroughRecording: () => {},
    cancelWalkthroughRecording: () => {},
  };
}

export const WalkthroughPlayerReactContext = createContext<WalkthroughPlayerState>(
  createDefaultWalkthroughPlayerState(),
);
