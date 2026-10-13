import { useEffect } from "react";
import { getCachedCanvasSnapshot, useDiagramStore, type Diagram } from "@/features/diagram";
import { useLLMStore } from "@/features/llm";
import type { DiagramToolHost } from "@/features/llm/tools/host";
import { useSkillStore } from "@/features/llm/skills/skill-store";
import { applyLayoutResultEdges } from "../layout/applyLayoutResult";
import { toAppliedLayouts } from "../layout/applyLayout";
import { fromDiagram, resizableIds } from "../layout/fromDiagram";
import { layout } from "../layout/layoutEngine";
import { canvasSkillFolderHost } from "./skillFolderHost";

/** The active diagram as the canvas shows it: the active version applied. */
function readDiagram(): Diagram | null {
  const state = useDiagramStore.getState();
  const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
  if (!diagram) return null;
  const resolved = getCachedCanvasSnapshot(diagram);
  return {
    ...diagram,
    snapshot: {
      ...diagram.snapshot,
      components: resolved.components,
      connections: resolved.connections,
    },
  };
}

/**
 * Lays the diagram out with the canvas's layout engine, writing positions and
 * edge routes without history: it finishes an accepted suggestion, whose
 * batch already took the undo checkpoint.
 */
async function autoLayout(): Promise<void> {
  const state = useDiagramStore.getState();
  const diagramId = state.activeDiagramId;
  const diagram = diagramId ? state.diagrams[diagramId] : undefined;
  if (!diagramId || !diagram) return;
  const components = diagram.snapshot.components;
  const graph = fromDiagram(
    components,
    Object.values(diagram.snapshot.connections),
    diagram.nodeLayouts,
  );
  try {
    const result = await layout(graph);
    useDiagramStore
      .getState()
      .applyAutoLayout(
        toAppliedLayouts(graph, result, resizableIds(graph, components)),
        undefined,
        {
          history: false,
        },
      );
    applyLayoutResultEdges(graph, result, diagramId, { history: false });
  } catch (err) {
    console.error("[chat] auto-layout failed:", err);
  }
}

/** What the chat's tools and suggestions use to reach the diagram and the canvas. */
export const canvasDiagramToolHost: DiagramToolHost = {
  readDiagram,
  applyChanges: (changes) => useDiagramStore.getState().applyChangeBatch(changes),
  autoLayout,
};

/**
 * Hands the chat its diagram host, and the workspace folder its skills live
 * in, while the canvas that hosts the chat is mounted.
 */
export function useProvideChatToolHost(): void {
  useEffect(() => {
    useLLMStore.getState().setToolHost(canvasDiagramToolHost);
    useSkillStore.getState().setFolderHost(canvasSkillFolderHost);
    return () => {
      useLLMStore.getState().setToolHost(null);
      useSkillStore.getState().setFolderHost(null);
    };
  }, []);
}
