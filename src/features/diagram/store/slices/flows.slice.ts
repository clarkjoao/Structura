import type { Flow, FlowStep, FlowBranch } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import { parseMermaidToSteps } from "../../utils/flow-mermaid";
import type { AppState } from "../store.types";
import { resolveSceneSnapshot } from "../../utils/scene.utils";

export const flowsSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    addFlow: (diagramId: string, name: string, mermaid: string, precomputedSteps?: Record<string, FlowStep>): Flow => {
      const { diagrams } = get();
      const d = diagrams[diagramId];
      if (!d) throw new Error("Diagram not found");
      const activeId = get().activeDiagramId;
      const r = resolveSceneSnapshot(
        d,
        activeId === diagramId ? d.activeSceneId ?? null : null,
      );

      let steps: Record<string, FlowStep>;
      let entryStepId: string | undefined;

      if (precomputedSteps && Object.keys(precomputedSteps).length > 0) {
        steps = precomputedSteps;
        const firstKey = Object.keys(steps)[0];
        entryStepId = firstKey;
      } else if (mermaid.trim()) {
        steps = parseMermaidToSteps(mermaid, r.components, r.connections);
        const inbound = new Set<string>();
        for (const s of Object.values(steps)) {
          if ("next" in s && s.next) inbound.add(s.next);
          if ("branches" in s && s.branches) s.branches.forEach((b) => inbound.add(b.nextId));
        }
        const roots = Object.keys(steps).filter((id) => !inbound.has(id));
        entryStepId = roots[0] ?? Object.keys(steps)[0];
      } else {
        const stepId = generateId("step");
        steps = {
          [stepId]: { id: stepId, type: "action" },
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
        if (patch.mermaid !== undefined && patch.steps === undefined) {
          const r = resolveSceneSnapshot(d, d.activeSceneId ?? null);
          flow.steps = parseMermaidToSteps(
            patch.mermaid ?? flow.mermaid,
            r.components,
            r.connections,
          );
        }
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
        flow.steps[stepId] = { ...step, id: stepId } as FlowStep;
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
          if ("next" in s && s.next === stepId) s.next = undefined;
          if ("branches" in s && s.branches) {
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
        if (!("branches" in step)) return;
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
        if (!step || !("branches" in step) || !step.branches) return;
        const removed = step.branches[branchIndex];
        step.branches.splice(branchIndex, 1);
        // Clean up orphaned branch target step
        if (removed) {
          const targetStep = flow.steps[removed.nextId];
          if (targetStep) {
            // Check if any other step still references this target
            const stillReferenced = Object.values(flow.steps).some((s) => {
              if ("next" in s && s.next === removed.nextId) return true;
              if ("branches" in s && s.branches) return s.branches.some((b) => b.nextId === removed.nextId);
              return false;
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

        const branches: FlowBranch[] = [];
        for (const label of branchLabels) {
          const branchStepId = generateId("step");
          flow.steps[branchStepId] = { id: branchStepId, type: 'action' };
          branches.push({ label, nextId: branchStepId });
        }
        flow.steps[stepId] = {
          id: stepId,
          type: "condition",
          conditionLabel,
          next: undefined,
          branches,
        };
      });
    },
});
