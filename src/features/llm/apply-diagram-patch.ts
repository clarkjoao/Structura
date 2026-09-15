import { useDiagramStore } from "@/features/diagram";
import { layout } from "@/features/canvas/layout/layoutEngine";
import { fromDiagram, resizableIds } from "@/features/canvas/layout/fromDiagram";
import { toAppliedLayouts } from "@/features/canvas/layout/applyLayout";
import { applyLayoutResultEdges } from "@/features/canvas/layout/applyLayoutResult";
import { PATTERNS } from "@/lib/catalogs/patterns";
import type { DiagramPatchAction } from "./types";
import { listElementFamilies, searchElements } from "./element-catalog-query";
import { validateAddNodeAgainstRegistry } from "./add-node-validation";

export interface AppliedPatchResult {
  addedNodeId: string | null;
  addedEdgeId: string | null;
  skipped?: boolean;
  skipReason?: string;
  toolResult?: {
    type:
      "INSERT_PATTERN" | "AUTO_LAYOUT" | "GET_TAGS" | "LIST_ELEMENT_FAMILIES" | "SEARCH_ELEMENTS";
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
      const registryCheck = validateAddNodeAgainstRegistry(
        action.payload.nodeType,
        action.payload.awsService,
      );
      if (!registryCheck.ok) {
        console.warn(`[LLM] ADD_NODE skipped — ${registryCheck.reason}`);
        return {
          addedNodeId: null,
          addedEdgeId: null,
          skipped: true,
          skipReason: registryCheck.reason,
        };
      }

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
      // Refused: the source is a type nothing may leave (a note, a JSON
      // viewer, a db-table). Reporting no edge is what keeps the suggestion
      // preview honest — it lists the ids that exist, so the arrow is simply
      // not claimed. Warned rather than surfaced, matching how an unresolved
      // `@ref` in the same action is handled in `llm/store.ts`.
      if (!connection) {
        console.warn(
          "[LLM] ADD_EDGE skipped - nothing connects out of this source type",
          action.payload.sourceId,
        );
        return { addedNodeId: null, addedEdgeId: null };
      }
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
      const components = diagram.snapshot.components;
      const connectionsList = Object.values(diagram.snapshot.connections);
      const graph = fromDiagram(components, connectionsList, diagram.nodeLayouts);
      void layout(graph)
        .then((result) => {
          const { applyAutoLayout } = useDiagramStore.getState();
          // One mutation for the whole run, so a model-initiated relayout is a
          // single undo step rather than an unreachable pile of per-node writes.
          applyAutoLayout(toAppliedLayouts(graph, result, resizableIds(graph, components)));
          // All edges from the graph get handle order and waypoints — same as every
          // other layout consumer.
          applyLayoutResultEdges(graph, result, diagramId);
          console.info(`[apply-diagram-patch] AUTO_LAYOUT: positioned ${result.boxes.size} nodes`);
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
    case "LIST_ELEMENT_FAMILIES": {
      const diagramId = diagramState.activeDiagramId;
      const components =
        diagramId && diagramState.diagrams[diagramId]
          ? diagramState.diagrams[diagramId].snapshot.components
          : {};
      return {
        addedNodeId: null,
        addedEdgeId: null,
        toolResult: {
          type: "LIST_ELEMENT_FAMILIES",
          data: listElementFamilies(components),
        },
      };
    }
    case "SEARCH_ELEMENTS": {
      return {
        addedNodeId: null,
        addedEdgeId: null,
        toolResult: {
          type: "SEARCH_ELEMENTS",
          data: searchElements(action.payload),
        },
      };
    }
    default:
      return { addedNodeId: null, addedEdgeId: null };
  }
}

/**
 * Run a patch's catalog-read actions and return their tool results.
 *
 * Call this *before* ADD_NODE. Ordering the reads first is what lets a model
 * emit `search_elements` and `add_node` in one response and still have the
 * results available in that same turn (F8b) — the useful half of that slice.
 *
 * It deliberately does **not** compute a set of "confirmed" pairs to validate
 * the writes against; see `add-node-validation.ts` for why that gate was
 * retired.
 */
export function runCatalogReadActions(actions: DiagramPatchAction[]): {
  catalogToolResults: NonNullable<AppliedPatchResult["toolResult"]>[];
} {
  const catalogToolResults: NonNullable<AppliedPatchResult["toolResult"]>[] = [];

  for (const action of actions) {
    if (action.type !== "LIST_ELEMENT_FAMILIES" && action.type !== "SEARCH_ELEMENTS") {
      continue;
    }
    const applied = applyDiagramPatchAction(action);
    if (applied.toolResult) {
      catalogToolResults.push(applied.toolResult);
    }
  }

  return { catalogToolResults };
}
