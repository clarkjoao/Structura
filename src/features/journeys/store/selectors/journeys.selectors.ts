import { useShallow } from "zustand/react/shallow";
import type { Journey, JourneyStep } from "../../types";
import { useJourneyStore } from "../journeys.store";

function sortJourneysByUpdatedAtDesc(journeys: Journey[]): Journey[] {
  return [...journeys].sort((a, b) => b.updatedAt - a.updatedAt);
}

export const useAllJourneys = (): Journey[] =>
  useJourneyStore(
    useShallow((state) =>
      sortJourneysByUpdatedAtDesc(Object.values(state.journeys)),
    ),
  );

export const useJourneys = useAllJourneys;

export const useJourneyById = (id: string): Journey | null =>
  useJourneyStore(
    useShallow((state) => (id ? (state.journeys[id] ?? null) : null)),
  );

export const useJourney = useJourneyById;

export const useJourneySteps = (journeyId: string): JourneyStep[] =>
  useJourneyStore(
    useShallow((state) => {
      const journey = state.journeys[journeyId];
      if (!journey) return [];
      return [...Object.values(journey.steps)].sort(
        (a, b) => a.order - b.order,
      );
    }),
  );

export const useJourneyActions = () =>
  useJourneyStore(
    useShallow((state) => ({
      addJourney: state.addJourney,
      updateJourney: state.updateJourney,
      removeJourney: state.removeJourney,
      addJourneyStep: state.addJourneyStep,
      updateJourneyStep: state.updateJourneyStep,
      removeJourneyStep: state.removeJourneyStep,
      reorderJourneySteps: state.reorderJourneySteps,
    })),
  );

export const useJourneysByDiagramId = (diagramId: string): Journey[] =>
  useJourneyStore(
    useShallow((state) => {
      const matches = Object.values(state.journeys).filter((journey) =>
        Object.values(journey.steps).some(
          (step) => step.diagramId === diagramId,
        ),
      );
      return sortJourneysByUpdatedAtDesc(matches);
    }),
  );
