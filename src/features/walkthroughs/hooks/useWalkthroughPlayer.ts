import { useContext } from "react";
import { WalkthroughPlayerReactContext } from "../components/walkthrough-player-context.shared";
import type { WalkthroughPlayerState } from "../types";

export function useWalkthroughPlayer(): WalkthroughPlayerState {
  return useContext(WalkthroughPlayerReactContext);
}
