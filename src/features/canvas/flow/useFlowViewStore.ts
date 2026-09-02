import { create } from "zustand";

interface FlowViewState {
  /**
   * The flow whose script is open. It is also the flow that numbers the
   * canvas: labels only mean anything inside one flow's graph, so two flows
   * numbering the same node at once would put two unrelated numbers on it.
   */
  scriptFlowId: string | null;
  /** The row the script panel has focused, kept in step with the canvas selection. */
  selectedStepId: string | null;
  openScript: (flowId: string | null) => void;
  selectStep: (stepId: string | null) => void;
}

export const useFlowViewStore = create<FlowViewState>((set) => ({
  scriptFlowId: null,
  selectedStepId: null,
  openScript: (flowId) =>
    set((state) => ({
      scriptFlowId: flowId,
      // A different flow's rows are not this flow's rows.
      selectedStepId: flowId === state.scriptFlowId ? state.selectedStepId : null,
    })),
  selectStep: (stepId) => set({ selectedStepId: stepId }),
}));
