import type {
  ChangeBatchReceipt,
  DiagramChange,
  DiagramChangeSkipReason,
} from "@/features/diagram";
import { resolvePattern } from "@/features/elements/patterns";
import { getPattern } from "@/lib/catalogs/patterns";
import { isAutoLayoutAction } from "./patch-actions";
import type { DiagramToolHost } from "./tools/host";
import type { DiagramPatchAction } from "./types";

const PATTERN_POSITION = { x: 300, y: 300 };

/** A queued action that could not be applied at Accept time, and why. */
export interface SkippedAction {
  actionIndex: number;
  reason: DiagramChangeSkipReason | "unknownPattern";
}

function toChange(action: DiagramPatchAction): DiagramChange | "unknownPattern" | null {
  switch (action.type) {
    case "ADD_NODE":
      return {
        kind: "addNode",
        ref: action.payload.ref,
        type: action.payload.nodeType,
        name: action.payload.name,
        parentId: action.payload.parentId,
        ...(action.payload.position ? { position: action.payload.position } : {}),
        ...(action.payload.serviceId ? { serviceId: action.payload.serviceId } : {}),
        ...(action.payload.panelKind ? { panelKind: action.payload.panelKind } : {}),
      };
    case "UPDATE_NODE":
      return { kind: "updateNode", id: action.payload.nodeId, patch: action.payload.patch };
    case "REMOVE_NODE":
      return { kind: "removeNode", id: action.payload.nodeId };
    case "ADD_EDGE":
      return {
        kind: "addEdge",
        sourceId: action.payload.sourceId,
        targetId: action.payload.targetId,
        label: action.payload.label,
        ...(action.payload.edgeStyle ? { edgeStyle: action.payload.edgeStyle } : {}),
      };
    case "REMOVE_EDGE":
      return { kind: "removeEdge", id: action.payload.edgeId };
    case "INSERT_PATTERN": {
      const pattern = getPattern(action.payload.patternId);
      if (!pattern) return "unknownPattern";
      return {
        kind: "insertPattern",
        fragment: resolvePattern(pattern, action.payload.provider),
        position: PATTERN_POSITION,
      };
    }
    case "AUTO_LAYOUT":
      return null;
  }
}

/** What applying a suggestion did. */
export interface AppliedSuggestion {
  skipped: SkippedAction[];
  /** How to take it back as one step; null when it took no undo checkpoint. */
  receipt: ChangeBatchReceipt | null;
  /** Elements the suggestion added, for the canvas preview. */
  addedNodeIds: string[];
  addedEdgeIds: string[];
}

/** Nodes added without a position stack on one spot; from two of them on, lay out. */
const MIN_UNPLACED_FOR_LAYOUT = 2;

/**
 * Whether the suggestion ends with a layout: when it queued one, or when it
 * adds several nodes without a position (they would pile up where new nodes
 * land), so what the canvas shows is already readable.
 */
function needsLayout(actions: readonly DiagramPatchAction[]): boolean {
  if (actions.some(isAutoLayoutAction)) return true;
  const unplaced = actions.filter(
    (action) => action.type === "ADD_NODE" && !action.payload.position,
  ).length;
  return unplaced >= MIN_UNPLACED_FOR_LAYOUT;
}

function elementIds(host: DiagramToolHost): { nodes: Set<string>; edges: Set<string> } {
  const snapshot = host.readDiagram()?.snapshot;
  return {
    nodes: new Set(Object.keys(snapshot?.components ?? {})),
    edges: new Set(Object.keys(snapshot?.connections ?? {})),
  };
}

/**
 * Applies a suggestion: every change in one diagram-store batch (one undo
 * step), then the layout if one was queued, without a checkpoint of its own.
 * Reports the actions that no longer applied, the elements it added and how
 * to take it back.
 */
export async function applySuggestion(
  actions: readonly DiagramPatchAction[],
  host: DiagramToolHost,
): Promise<AppliedSuggestion> {
  const changes: DiagramChange[] = [];
  const actionIndexOfChange: number[] = [];
  const skipped: SkippedAction[] = [];

  actions.forEach((action, actionIndex) => {
    const change = toChange(action);
    if (change === "unknownPattern") {
      skipped.push({ actionIndex, reason: "unknownPattern" });
    } else if (change) {
      changes.push(change);
      actionIndexOfChange.push(actionIndex);
    }
  });

  const before = elementIds(host);
  const result = host.applyChanges(changes);
  for (const { index, reason } of result.skipped) {
    const actionIndex = actionIndexOfChange[index];
    if (actionIndex !== undefined) skipped.push({ actionIndex, reason });
  }

  if (needsLayout(actions)) {
    await host.autoLayout();
  }
  const after = elementIds(host);
  return {
    skipped: skipped.sort((a, b) => a.actionIndex - b.actionIndex),
    receipt: host.takeReceipt(result.checkpoint),
    addedNodeIds: [...after.nodes].filter((id) => !before.nodes.has(id)),
    addedEdgeIds: [...after.edges].filter((id) => !before.edges.has(id)),
  };
}
