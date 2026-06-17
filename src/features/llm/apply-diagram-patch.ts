import { useDiagramStore } from "@/features/diagram";
import type { DiagramPatchAction } from "./types";

interface AppliedPatchResult {
  addedNodeId: string | null;
  addedEdgeId: string | null;
}

export function resolveRef(value: string, nameToIdMap: Map<string, string>): string {
  const match = value.match(/^@ref:(.+)$/i);
  if (!match) {
    return value;
  }
  return nameToIdMap.get(match[1].toLowerCase()) ?? value;
}

export function computeGridPositions(
  count: number,
  startX = 200,
  startY = 200,
): Array<{ x: number; y: number }> {
  const COL_GAP = 320;
  const ROW_GAP = 160;
  const COLS = 3;
  return Array.from({ length: count }, (_, index) => ({
    x: startX + (index % COLS) * COL_GAP,
    y: startY + Math.floor(index / COLS) * ROW_GAP,
  }));
}

export function applyDiagramPatchAction(action: DiagramPatchAction): AppliedPatchResult {
  const diagramState = useDiagramStore.getState();

  switch (action.type) {
    case "ADD_NODE":
      return {
        addedNodeId: diagramState.addComponent(
          action.payload.nodeType,
          action.payload.name,
          action.payload.parentId,
          action.payload.position,
          action.payload.awsService,
        ).id,
        addedEdgeId: null,
      };
    case "REMOVE_NODE":
      diagramState.removeComponent(action.payload.nodeId);
      return { addedNodeId: null, addedEdgeId: null };
    case "UPDATE_NODE":
      diagramState.updateComponent(action.payload.nodeId, action.payload.patch);
      return { addedNodeId: null, addedEdgeId: null };
    case "ADD_EDGE": {
      const connection = diagramState.addConnection(
        action.payload.sourceId,
        action.payload.targetId,
        action.payload.label,
        action.payload.edgeStyle,
      );
      if (action.payload.patch) {
        diagramState.updateConnection(connection.id, action.payload.patch);
      }
      return { addedNodeId: null, addedEdgeId: connection.id };
    }
    case "REMOVE_EDGE":
      diagramState.removeConnection(action.payload.edgeId);
      return { addedNodeId: null, addedEdgeId: null };
    default:
      return { addedNodeId: null, addedEdgeId: null };
  }
}
