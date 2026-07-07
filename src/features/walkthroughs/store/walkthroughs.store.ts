import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Walkthrough, WalkthroughStep } from "../types";
import { SEED_WALKTHROUGHS } from "@/fixtures/seeds/walkthrough-seeds";

interface WalkthroughStoreState {
  walkthroughs: Record<string, Walkthrough>;
  addWalkthrough: (name: string, description?: string, domain?: string) => Walkthrough;
  updateWalkthrough: (id: string, patch: Partial<Omit<Walkthrough, "id" | "createdAt">>) => void;
  removeWalkthrough: (id: string) => void;
  addWalkthroughStep: (
    walkthroughId: string,
    step: Omit<WalkthroughStep, "id" | "order">,
  ) => WalkthroughStep;
  updateWalkthroughStep: (
    walkthroughId: string,
    stepId: string,
    patch: Partial<Omit<WalkthroughStep, "id">>,
  ) => void;
  removeWalkthroughStep: (walkthroughId: string, stepId: string) => void;
  reorderWalkthroughSteps: (walkthroughId: string, orderedStepIds: string[]) => void;
  duplicateWalkthrough: (sourceId: string, nameForDuplicate?: string) => Walkthrough;
}

export function migrateWalkthroughStepsDiagramId(
  walkthroughs: Record<string, Walkthrough>,
): Record<string, Walkthrough> {
  let changed = false;
  const next: Record<string, Walkthrough> = {};
  for (const [walkthroughId, walkthrough] of Object.entries(walkthroughs)) {
    let walkthroughChanged = false;
    const nextSteps: Record<string, WalkthroughStep> = { ...walkthrough.steps };
    for (const [stepId, step] of Object.entries(walkthrough.steps)) {
      if (step.diagramId === undefined || step.diagramId === null) {
        nextSteps[stepId] = { ...step, diagramId: "" };
        walkthroughChanged = true;
      }
    }
    if (walkthroughChanged) {
      changed = true;
      next[walkthroughId] = { ...walkthrough, steps: nextSteps };
    } else {
      next[walkthroughId] = walkthrough;
    }
  }
  return changed ? next : walkthroughs;
}

export const useWalkthroughsStore = create<WalkthroughStoreState>()(
  persist(
    (set) => ({
      walkthroughs: import.meta.env.VITE_DISABLE_SEEDS === "true" ? {} : SEED_WALKTHROUGHS,

      addWalkthrough: (name, description, domain) => {
        const now = Date.now();
        const walkthrough: Walkthrough = {
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
          walkthroughs: { ...state.walkthroughs, [walkthrough.id]: walkthrough },
        }));
        return walkthrough;
      },

      updateWalkthrough: (id, patch) =>
        set((state) => {
          const existing = state.walkthroughs[id];
          if (!existing) return state;
          return {
            walkthroughs: {
              ...state.walkthroughs,
              [id]: {
                ...existing,
                ...patch,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeWalkthrough: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.walkthroughs;
          return { walkthroughs: rest };
        }),

      duplicateWalkthrough: (sourceId, nameForDuplicate) => {
        const source = useWalkthroughsStore.getState().walkthroughs[sourceId];
        if (!source) {
          throw new Error(`Walkthrough not found: ${sourceId}`);
        }
        const now = Date.now();
        const newWalkthroughId = crypto.randomUUID();
        const sortedSteps = Object.values(source.steps).sort(
          (stepA, stepB) => stepA.order - stepB.order,
        );
        const nextSteps: Record<string, WalkthroughStep> = {};
        for (const step of sortedSteps) {
          const stepNewId = crypto.randomUUID();
          nextSteps[stepNewId] = {
            id: stepNewId,
            label: step.label,
            description: step.description,
            duration: step.duration,
            order: step.order,
            diagramId: step.diagramId,
            flowId: step.flowId,
            svgContent: step.svgContent,
            mediaContent: step.mediaContent
              ? {
                  type: step.mediaContent.type,
                  data: step.mediaContent.data,
                }
              : undefined,
          };
        }
        const duplicateName = nameForDuplicate ?? `${source.name} (copy)`;
        const walkthrough: Walkthrough = {
          id: newWalkthroughId,
          name: duplicateName,
          description: source.description,
          domain: source.domain,
          tags: [...source.tags],
          steps: nextSteps,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          walkthroughs: {
            ...state.walkthroughs,
            [newWalkthroughId]: walkthrough,
          },
        }));
        return walkthrough;
      },

      addWalkthroughStep: (walkthroughId, stepInput) => {
        let created: WalkthroughStep | undefined;
        set((state) => {
          const existingWalkthrough = state.walkthroughs[walkthroughId];
          if (!existingWalkthrough) return state;
          const existingOrders = Object.values(existingWalkthrough.steps).map((step) => step.order);
          const nextOrder = Math.max(...existingOrders, -1) + 1;
          const step: WalkthroughStep = {
            ...stepInput,
            diagramId: stepInput.diagramId ?? "",
            id: crypto.randomUUID(),
            order: nextOrder,
          };
          created = step;
          return {
            walkthroughs: {
              ...state.walkthroughs,
              [walkthroughId]: {
                ...existingWalkthrough,
                steps: { ...existingWalkthrough.steps, [step.id]: step },
                updatedAt: Date.now(),
              },
            },
          };
        });
        if (!created) {
          throw new Error(`Walkthrough not found: ${walkthroughId}`);
        }
        return created;
      },

      updateWalkthroughStep: (walkthroughId, stepId, patch) =>
        set((state) => {
          const walkthrough = state.walkthroughs[walkthroughId];
          if (!walkthrough) return state;
          const existingStep = walkthrough.steps[stepId];
          if (!existingStep) return state;
          const diagramId =
            patch.diagramId === undefined || patch.diagramId === null
              ? existingStep.diagramId
              : patch.diagramId;
          return {
            walkthroughs: {
              ...state.walkthroughs,
              [walkthroughId]: {
                ...walkthrough,
                steps: {
                  ...walkthrough.steps,
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

      removeWalkthroughStep: (walkthroughId, stepId) =>
        set((state) => {
          const walkthrough = state.walkthroughs[walkthroughId];
          if (!walkthrough) return state;
          const { [stepId]: _removed, ...restSteps } = walkthrough.steps;
          const sorted = Object.values(restSteps).sort((a, b) => a.order - b.order);
          const reindexed: Record<string, WalkthroughStep> = {};
          sorted.forEach((step, index) => {
            reindexed[step.id] = { ...step, order: index };
          });
          return {
            walkthroughs: {
              ...state.walkthroughs,
              [walkthroughId]: {
                ...walkthrough,
                steps: reindexed,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      reorderWalkthroughSteps: (walkthroughId, orderedStepIds) =>
        set((state) => {
          const walkthrough = state.walkthroughs[walkthroughId];
          if (!walkthrough) return state;
          const nextSteps = { ...walkthrough.steps };
          for (let index = 0; index < orderedStepIds.length; index += 1) {
            const stepId = orderedStepIds[index];
            const step = nextSteps[stepId];
            if (!step) continue;
            nextSteps[stepId] = { ...step, order: index };
          }
          return {
            walkthroughs: {
              ...state.walkthroughs,
              [walkthroughId]: {
                ...walkthrough,
                steps: nextSteps,
                updatedAt: Date.now(),
              },
            },
          };
        }),
    }),
    {
      name: "structura:walkthroughs",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ walkthroughs: state.walkthroughs }),
    },
  ),
);

void useWalkthroughsStore.persist.onFinishHydration(() => {
  useWalkthroughsStore.setState((state) => {
    const migrated = migrateWalkthroughStepsDiagramId(state.walkthroughs);
    if (migrated === state.walkthroughs) return state;
    return { walkthroughs: migrated };
  });
});
