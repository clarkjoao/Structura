import type { DiagramChange, DiagramChangeSkipReason } from "@/features/diagram";
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

/**
 * Applies an accepted suggestion: every change in one diagram-store batch
 * (one undo step), then the layout if one was queued, without a checkpoint of
 * its own. Returns the actions that no longer applied.
 */
export async function applySuggestion(
  actions: readonly DiagramPatchAction[],
  host: DiagramToolHost,
): Promise<SkippedAction[]> {
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

  const result = host.applyChanges(changes);
  for (const { index, reason } of result.skipped) {
    const actionIndex = actionIndexOfChange[index];
    if (actionIndex !== undefined) skipped.push({ actionIndex, reason });
  }

  if (actions.some(isAutoLayoutAction)) {
    await host.autoLayout();
  }
  return skipped.sort((a, b) => a.actionIndex - b.actionIndex);
}
