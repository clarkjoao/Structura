import type { Flow, FlowStep } from "../../model/diagram.types";
import { generateId } from "../../model/diagram.utils";
import { parseMermaidToSteps } from "../../model/flow.service";
import type { AppState } from "../store.types";

export const flowsSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    addFlow: (diagramId: string, name: string, mermaid: string, precomputedSteps?: FlowStep[]): Flow => {
      const { diagrams } = get();
      const d = diagrams[diagramId];
      if (!d) throw new Error("Diagram not found");
      const steps =
        precomputedSteps ??
        parseMermaidToSteps(mermaid, d.snapshot.components, d.snapshot.connections);
      const flow: Flow = {
        id: generateId("flow"),
        name,
        mermaid,
        steps,
        diagramId,
      };
      set((state) => {
        state.diagrams[diagramId].snapshot.flows[flow.id] = flow;
      });
      return flow;
    },

    updateFlow: (id: string, patch: Partial<Omit<Flow, "id">>) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        const flow = d.snapshot.flows[id];
        if (!flow) return;
        Object.assign(flow, patch);
        if (patch.mermaid !== undefined && patch.steps === undefined) {
          flow.steps = parseMermaidToSteps(
            patch.mermaid ?? flow.mermaid,
            d.snapshot.components,
            d.snapshot.connections,
          );
        }
      });
    },

    removeFlow: (id: string) => {
      set((state) => {
        delete state.diagrams[state.activeDiagramId!].snapshot.flows[id];
      });
    },
});
