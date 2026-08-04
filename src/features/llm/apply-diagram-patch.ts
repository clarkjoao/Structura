import { useDiagramStore } from "@/features/diagram";
import { computeAutoLayout } from "@/features/canvas/layout/autoLayoutEngine";
import { PATTERNS } from "@/lib/catalogs/patterns";
import type { DiagramPatchAction } from "./types";

export interface AppliedPatchResult {
  addedNodeId: string | null;
  addedEdgeId: string | null;
  toolResult?: {
    type: "INSERT_PATTERN" | "AUTO_LAYOUT" | "GET_TAGS";
    data?: unknown;
  };
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

export function resolveParentRef(
  value: string | null,
  nameToIdMap: Map<string, string>,
): string | null {
  if (!value) return null;
  if (value.startsWith("@ref:")) {
    const resolved = nameToIdMap.get(value.slice(5).toLowerCase());
    return resolved ?? null;
  }
  return value;
}

export function applyDiagramPatchAction(
  action: DiagramPatchAction,
  nameToIdMap?: Map<string, string>,
): AppliedPatchResult {
  const diagramState = useDiagramStore.getState();

  switch (action.type) {
    case "ADD_NODE": {
      const resolvedParentId = resolveParentRef(action.payload.parentId, nameToIdMap ?? new Map());
      return {
        addedNodeId: diagramState.addComponent(
          action.payload.nodeType,
          action.payload.name,
          resolvedParentId,
          action.payload.position,
          action.payload.awsService,
        ).id,
        addedEdgeId: null,
      };
    }
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
    case "INSERT_PATTERN": {
      const pattern = PATTERNS.find((p) => p.id === action.payload.patternId);
      if (!pattern) {
        console.warn(`[LLM] Pattern not found: ${action.payload.patternId}`);
        return { addedNodeId: null, addedEdgeId: null };
      }
      const insertedIds = diagramState.insertPattern(pattern, { x: 300, y: 300 });
      return {
        addedNodeId: insertedIds[0] ?? null,
        addedEdgeId: null,
        toolResult: {
          type: "INSERT_PATTERN",
          data: { patternId: pattern.id, createdNodes: insertedIds },
        },
      };
    }
    case "AUTO_LAYOUT": {
      const diagramId = diagramState.activeDiagramId;
      if (!diagramId) {
        console.info("[apply-diagram-patch] AUTO_LAYOUT: no active diagram");
        return { addedNodeId: null, addedEdgeId: null, toolResult: { type: "AUTO_LAYOUT" } };
      }
      const diagram = diagramState.diagrams[diagramId];
      if (!diagram) {
        console.info("[apply-diagram-patch] AUTO_LAYOUT: diagram not found");
        return { addedNodeId: null, addedEdgeId: null, toolResult: { type: "AUTO_LAYOUT" } };
      }
      const connectionsList = Object.values(diagram.snapshot.connections);
      void computeAutoLayout(diagram.snapshot.components, connectionsList, diagram.nodeLayouts)
        .then((result) => {
          const { updateNodeLayout, resetEdgeControlPoints } = useDiagramStore.getState();
          // Apply positions to nodes
          for (const { elementId, x, y } of result.positions) {
            updateNodeLayout(elementId, { x, y });
          }
          // Reset edge control points for laid-out connections
          for (const connId of result.laidOutConnectionIds) {
            resetEdgeControlPoints(diagramId, connId);
          }
          console.info(
            `[apply-diagram-patch] AUTO_LAYOUT: positioned ${result.positions.length} nodes`,
          );
        })
        .catch((err) => {
          console.error("[llm] auto-layout failed:", err);
        });
      return { addedNodeId: null, addedEdgeId: null, toolResult: { type: "AUTO_LAYOUT" } };
    }
    case "GET_TAGS": {
      // GET_TAGS is a read-only operation handled separately
      return { addedNodeId: null, addedEdgeId: null, toolResult: { type: "GET_TAGS" } };
    }
    default:
      return { addedNodeId: null, addedEdgeId: null };
  }
}
