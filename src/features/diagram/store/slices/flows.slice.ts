import type { Flow, FlowStep } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import { parseMermaidToSteps } from "../../utils/flow-mermaid";
import type { AppState } from "../store.types";
import { resolveSceneSnapshot } from "../../utils/scene.utils";

export const flowsSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    addFlow: (diagramId: string, name: string, mermaid: string, precomputedSteps?: FlowStep[]): Flow => {
      const { diagrams } = get();
      const d = diagrams[diagramId];
      if (!d) throw new Error("Diagram not found");
      const activeId = get().activeDiagramId;
      const r = resolveSceneSnapshot(
        d,
        activeId === diagramId ? d.activeSceneId ?? null : null,
      );
      const steps =
        precomputedSteps ?? parseMermaidToSteps(mermaid, r.components, r.connections);
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
});
