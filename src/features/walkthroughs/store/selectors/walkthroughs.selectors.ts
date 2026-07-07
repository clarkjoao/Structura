import { useShallow } from "zustand/react/shallow";
import type { Walkthrough, WalkthroughStep } from "../../types";
import { useWalkthroughsStore } from "../walkthroughs.store";

function sortWalkthroughsByUpdatedAtDesc(walkthroughs: Walkthrough[]): Walkthrough[] {
  return [...walkthroughs].sort((a, b) => b.updatedAt - a.updatedAt);
}

export const useAllWalkthroughs = (): Walkthrough[] =>
  useWalkthroughsStore(
    useShallow((state) => sortWalkthroughsByUpdatedAtDesc(Object.values(state.walkthroughs))),
  );

export const useWalkthroughs = useAllWalkthroughs;

export const useWalkthroughById = (id: string): Walkthrough | null =>
  useWalkthroughsStore(useShallow((state) => (id ? (state.walkthroughs[id] ?? null) : null)));

export const useWalkthrough = useWalkthroughById;

export const useWalkthroughSteps = (walkthroughId: string): WalkthroughStep[] =>
  useWalkthroughsStore(
    useShallow((state) => {
      const walkthrough = state.walkthroughs[walkthroughId];
      if (!walkthrough) return [];
      return [...Object.values(walkthrough.steps)].sort((a, b) => a.order - b.order);
    }),
  );

export const useWalkthroughActions = () =>
  useWalkthroughsStore(
    useShallow((state) => ({
      addWalkthrough: state.addWalkthrough,
      updateWalkthrough: state.updateWalkthrough,
      removeWalkthrough: state.removeWalkthrough,
      addWalkthroughStep: state.addWalkthroughStep,
      updateWalkthroughStep: state.updateWalkthroughStep,
      removeWalkthroughStep: state.removeWalkthroughStep,
      reorderWalkthroughSteps: state.reorderWalkthroughSteps,
      duplicateWalkthrough: state.duplicateWalkthrough,
    })),
  );

export const useWalkthroughsByDiagramId = (diagramId: string): Walkthrough[] =>
  useWalkthroughsStore(
    useShallow((state) => {
      const matches = Object.values(state.walkthroughs).filter((walkthrough) =>
        Object.values(walkthrough.steps).some((step) => step.diagramId === diagramId),
      );
      return sortWalkthroughsByUpdatedAtDesc(matches);
    }),
  );
