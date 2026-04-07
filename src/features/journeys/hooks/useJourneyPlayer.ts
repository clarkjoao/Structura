import { useContext } from "react";
import { JourneyPlayerReactContext } from "../components/journey-player-context.shared";
import type { JourneyPlayerState } from "../types";

export function useJourneyPlayer(): JourneyPlayerState {
  return useContext(JourneyPlayerReactContext);
}
