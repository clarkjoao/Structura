import { useDiagramStore } from "@/features/diagram";
import { layout } from "@/features/canvas/layout/layoutEngine";
import { fromDiagram, resizableIds } from "@/features/canvas/layout/fromDiagram";
import { toAppliedLayouts } from "@/features/canvas/layout/applyLayout";
import { applyLayoutResultEdges } from "@/features/canvas/layout/applyLayoutResult";
import { getPattern } from "@/lib/catalogs/patterns";
import { resolvePattern } from "@/features/elements/patterns";
import type { DiagramPatchAction } from "./types";

const PATTERN_POSITION = { x: 300, y: 300 };

function runAutoLayout(): void {
  const diagramState = useDiagramStore.getState();
  const diagramId = diagramState.activeDiagramId;
  const diagram = diagramId ? diagramState.diagrams[diagramId] : undefined;
  if (!diagramId || !diagram) return;
  const components = diagram.snapshot.components;
  const graph = fromDiagram(
    components,
    Object.values(diagram.snapshot.connections),
    diagram.nodeLayouts,
  );
  void layout(graph)
    .then((result) => {
      useDiagramStore
        .getState()
        .applyAutoLayout(toAppliedLayouts(graph, result, resizableIds(graph, components)));
      applyLayoutResultEdges(graph, result, diagramId);
    })
    .catch((err) => {
      console.error("[llm] auto-layout failed:", err);
    });
}

/**
 * Applies an accepted suggestion's actions in order. Refs from ADD_NODE are
 * resolved to the ids the store mints, so later actions can point at them.
 */
export function applySuggestionActions(actions: readonly DiagramPatchAction[]): void {
  const idByRef = new Map<string, string>();
  const resolve = (id: string) => idByRef.get(id) ?? id;
  const store = useDiagramStore.getState();
  let layoutRequested = false;

  for (const action of actions) {
    switch (action.type) {
      case "ADD_NODE": {
        const { ref, nodeType, name, parentId, position, cloudServiceId } = action.payload;
        const component = store.addComponent(
          nodeType,
          name,
          parentId === null ? null : resolve(parentId),
          position,
          cloudServiceId,
        );
        idByRef.set(ref, component.id);
        break;
      }
      case "REMOVE_NODE":
        store.removeComponent(action.payload.nodeId);
        break;
      case "UPDATE_NODE":
        store.updateComponent(action.payload.nodeId, action.payload.patch);
        break;
      case "ADD_EDGE":
        store.addConnection(
          resolve(action.payload.sourceId),
          resolve(action.payload.targetId),
          action.payload.label,
          action.payload.edgeStyle,
        );
        break;
      case "REMOVE_EDGE":
        store.removeConnection(action.payload.edgeId);
        break;
      case "INSERT_PATTERN": {
        const pattern = getPattern(action.payload.patternId);
        if (pattern) {
          store.insertPattern(resolvePattern(pattern, action.payload.provider), PATTERN_POSITION);
        }
        break;
      }
      case "AUTO_LAYOUT":
        layoutRequested = true;
        break;
    }
  }
  if (layoutRequested) runAutoLayout();
}
