import { useContext } from "react";
import { JourneyPlayerReactContext } from "./journeyPlayerContext.shared";
import type { JourneyPlayerState } from "./journeyPlayer.types";

export function useJourneyPlayer(): JourneyPlayerState {
  return useContext(JourneyPlayerReactContext);
}
