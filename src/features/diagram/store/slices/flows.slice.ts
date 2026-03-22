import type { Flow, FlowStep, FlowBranch } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";

export const flowsSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    addFlow: (diagramId: string, name: string, mermaid: string, precomputedSteps?: Record<string, FlowStep>): Flow => {
      const { diagrams } = get();
      const d = diagrams[diagramId];
      if (!d) throw new Error("Diagram not found");

      let steps: Record<string, FlowStep>;
      let entryStepId: string | undefined;

      if (precomputedSteps && Object.keys(precomputedSteps).length > 0) {
        steps = precomputedSteps;
        // Find the entry step: look for entryStepId hint or pick first step
        const firstKey = Object.keys(steps)[0];
        entryStepId = firstKey;
      } else {
        // Create a single initial step
        const stepId = generateId("step");
        steps = {
          [stepId]: { id: stepId, type: 'action' },
        };
        entryStepId = stepId;
      }

      const flow: Flow = {
        id: generateId("flow"),
        name,
        mermaid,
        steps,
        diagramId,
        entryStepId,
      };
      set((state) => {
        state.diagrams[diagramId].snapshot.flows[flow.id] = flow;
      });
      return flow;
    },

    updateFlow: (id: string, patch: Partial<Omit<Flow, "id">>) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const flow = d.snapshot.flows[id];
        if (!flow) return;
        Object.assign(flow, patch);
      });
    },

    removeFlow: (id: string) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        delete d.snapshot.flows[id];
      });
    },

    addFlowStep: (flowId: string, step: Omit<FlowStep, 'id'>): string => {
      const stepId = generateId("step");
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const flow = d.snapshot.flows[flowId];
        if (!flow) return;
        flow.steps[stepId] = { ...step, id: stepId };
      });
      return stepId;
    },

    updateFlowStep: (flowId: string, stepId: string, patch: Partial<FlowStep>) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const flow = d.snapshot.flows[flowId];
        if (!flow || !flow.steps[stepId]) return;
        Object.assign(flow.steps[stepId], patch);
      });
    },

    removeFlowStep: (flowId: string, stepId: string) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const flow = d.snapshot.flows[flowId];
        if (!flow) return;

        // Remove all references pointing to this step
        for (const s of Object.values(flow.steps)) {
          if (s.next === stepId) s.next = undefined;
          if (s.branches) {
            s.branches = s.branches.filter((b) => b.nextId !== stepId);
          }
        }

        // Clear entry if it was this step
        if (flow.entryStepId === stepId) {
          flow.entryStepId = undefined;
        }

        delete flow.steps[stepId];
      });
    },

    addFlowBranch: (flowId: string, conditionStepId: string, branch: FlowBranch) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const flow = d.snapshot.flows[flowId];
        if (!flow) return;
        const step = flow.steps[conditionStepId];
        if (!step) return;
        if (!step.branches) step.branches = [];
        step.branches.push(branch);
      });
    },

    removeFlowBranch: (flowId: string, conditionStepId: string, branchIndex: number) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const flow = d.snapshot.flows[flowId];
        if (!flow) return;
        const step = flow.steps[conditionStepId];
        if (!step || !step.branches) return;
        const removed = step.branches[branchIndex];
        step.branches.splice(branchIndex, 1);
        // Clean up orphaned branch target step
        if (removed) {
          const targetStep = flow.steps[removed.nextId];
          if (targetStep) {
            // Check if any other step still references this target
            const stillReferenced = Object.values(flow.steps).some((s) => {
              if (s.next === removed.nextId) return true;
              return s.branches?.some((b) => b.nextId === removed.nextId);
            });
            if (!stillReferenced && flow.entryStepId !== removed.nextId) {
              delete flow.steps[removed.nextId];
            }
          }
        }
      });
    },

    convertStepToCondition: (flowId: string, stepId: string, conditionLabel: string, branchLabels: string[]) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const flow = d.snapshot.flows[flowId];
        if (!flow) return;
        const step = flow.steps[stepId];
        if (!step) return;

        step.type = 'condition';
        step.conditionLabel = conditionLabel;
        step.next = undefined;

        const branches: FlowBranch[] = [];
        for (const label of branchLabels) {
          const branchStepId = generateId("step");
          flow.steps[branchStepId] = { id: branchStepId, type: 'action' };
          branches.push({ label, nextId: branchStepId });
        }
        step.branches = branches;
      });
    },
});
