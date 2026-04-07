import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Journey, JourneyStep } from "../types";

interface JourneyStoreState {
  journeys: Record<string, Journey>;
  addJourney: (
    name: string,
    description?: string,
    domain?: string,
  ) => Journey;
  updateJourney: (
    id: string,
    patch: Partial<Omit<Journey, "id" | "createdAt">>,
  ) => void;
  removeJourney: (id: string) => void;
  addJourneyStep: (
    journeyId: string,
    step: Omit<JourneyStep, "id" | "order">,
  ) => JourneyStep;
  updateJourneyStep: (
    journeyId: string,
    stepId: string,
    patch: Partial<Omit<JourneyStep, "id">>,
  ) => void;
  removeJourneyStep: (journeyId: string, stepId: string) => void;
  reorderJourneySteps: (
    journeyId: string,
    orderedStepIds: string[],
  ) => void;
}

/** Normalizes persisted journeys where legacy steps omitted `diagramId`. */
export function migrateJourneyStepsDiagramId(
  journeys: Record<string, Journey>,
): Record<string, Journey> {
  let changed = false;
  const next: Record<string, Journey> = {};
  for (const [journeyId, journey] of Object.entries(journeys)) {
    let journeyChanged = false;
    const nextSteps: Record<string, JourneyStep> = { ...journey.steps };
    for (const [stepId, step] of Object.entries(journey.steps)) {
      if (step.diagramId === undefined || step.diagramId === null) {
        nextSteps[stepId] = { ...step, diagramId: "" };
        journeyChanged = true;
      }
    }
    if (journeyChanged) {
      changed = true;
      next[journeyId] = { ...journey, steps: nextSteps };
    } else {
      next[journeyId] = journey;
    }
  }
  return changed ? next : journeys;
}

export const useJourneyStore = create<JourneyStoreState>()(
  persist(
    (set) => ({
      journeys: {},

      addJourney: (name, description, domain) => {
        const now = Date.now();
        const journey: Journey = {
          id: crypto.randomUUID(),
          name,
          description,
          domain,
          tags: [],
          steps: {},
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          journeys: { ...state.journeys, [journey.id]: journey },
        }));
        return journey;
      },

      updateJourney: (id, patch) =>
        set((state) => {
          const existing = state.journeys[id];
          if (!existing) return state;
          return {
            journeys: {
              ...state.journeys,
              [id]: {
                ...existing,
                ...patch,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeJourney: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.journeys;
          return { journeys: rest };
        }),

      addJourneyStep: (journeyId, stepInput) => {
        let created: JourneyStep | undefined;
        set((state) => {
          const existingJourney = state.journeys[journeyId];
          if (!existingJourney) return state;
          const existingOrders = Object.values(existingJourney.steps).map(
            (step) => step.order,
          );
          const nextOrder = Math.max(...existingOrders, -1) + 1;
          const step: JourneyStep = {
            ...stepInput,
            diagramId: stepInput.diagramId ?? "",
            id: crypto.randomUUID(),
            order: nextOrder,
          };
          created = step;
          return {
            journeys: {
              ...state.journeys,
              [journeyId]: {
                ...existingJourney,
                steps: { ...existingJourney.steps, [step.id]: step },
                updatedAt: Date.now(),
              },
            },
          };
        });
        if (!created) {
          throw new Error(`Journey not found: ${journeyId}`);
        }
        return created;
      },

      updateJourneyStep: (journeyId, stepId, patch) =>
        set((state) => {
          const journey = state.journeys[journeyId];
          if (!journey) return state;
          const existingStep = journey.steps[stepId];
          if (!existingStep) return state;
          const diagramId =
            patch.diagramId === undefined || patch.diagramId === null
              ? existingStep.diagramId
              : patch.diagramId;
          return {
            journeys: {
              ...state.journeys,
              [journeyId]: {
                ...journey,
                steps: {
                  ...journey.steps,
                  [stepId]: {
                    ...existingStep,
                    ...patch,
                    diagramId: diagramId ?? "",
                  },
                },
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeJourneyStep: (journeyId, stepId) =>
        set((state) => {
          const journey = state.journeys[journeyId];
          if (!journey) return state;
          const { [stepId]: _removed, ...restSteps } = journey.steps;
          const sorted = Object.values(restSteps).sort((a, b) => a.order - b.order);
          const reindexed: Record<string, JourneyStep> = {};
          sorted.forEach((step, index) => {
            reindexed[step.id] = { ...step, order: index };
          });
          return {
            journeys: {
              ...state.journeys,
              [journeyId]: {
                ...journey,
                steps: reindexed,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      reorderJourneySteps: (journeyId, orderedStepIds) =>
        set((state) => {
          const journey = state.journeys[journeyId];
          if (!journey) return state;
          const nextSteps = { ...journey.steps };
          for (let index = 0; index < orderedStepIds.length; index += 1) {
            const stepId = orderedStepIds[index];
            const step = nextSteps[stepId];
            if (!step) continue;
            nextSteps[stepId] = { ...step, order: index };
          }
          return {
            journeys: {
              ...state.journeys,
              [journeyId]: {
                ...journey,
                steps: nextSteps,
                updatedAt: Date.now(),
              },
            },
          };
        }),
    }),
    {
      name: "structura:journeys",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ journeys: state.journeys }),
    },
  ),
);

void useJourneyStore.persist.onFinishHydration(() => {
  useJourneyStore.setState((state) => {
    const migrated = migrateJourneyStepsDiagramId(state.journeys);
    if (migrated === state.journeys) return state;
    return { journeys: migrated };
  });
});
