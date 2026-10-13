import {
  getCachedCanvasSnapshot,
  useDiagramStore,
  type Diagram,
  type DiagramChange,
  type DiagramChangeBatchResult,
} from "@/features/diagram";
import { layout } from "@/features/canvas/layout/layoutEngine";
import { fromDiagram, resizableIds } from "@/features/canvas/layout/fromDiagram";
import { toAppliedLayouts } from "@/features/canvas/layout/applyLayout";
import { applyLayoutResultEdges } from "@/features/canvas/layout/applyLayoutResult";
import type { DiagramToolHost } from "./host";

/** Reads the active diagram from the diagram store, as the canvas shows it. */
export function readActiveDiagram(): Diagram | null {
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

function applyChanges(changes: DiagramChange[]): DiagramChangeBatchResult {
  return useDiagramStore.getState().applyChangeBatch(changes);
}

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
    console.error("[llm] auto-layout failed:", err);
  }
}

/** The host the chat uses when none is provided. */
export const storeDiagramHost: DiagramToolHost = {
  readDiagram: readActiveDiagram,
  applyChanges,
  autoLayout,
};
