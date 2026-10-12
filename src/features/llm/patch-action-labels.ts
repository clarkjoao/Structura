import type { TFunction } from "i18next";
import type { DiagramPatchAction } from "./types";

/** What a patch action does to the diagram, for the +, ~ and − markers. */
export type PatchChangeKind = "add" | "update" | "remove" | "other";

export function patchChangeKind(action: DiagramPatchAction): PatchChangeKind {
  switch (action.type) {
    case "ADD_NODE":
    case "ADD_EDGE":
    case "INSERT_PATTERN":
      return "add";
    case "UPDATE_NODE":
    case "AUTO_LAYOUT":
      return "update";
    case "REMOVE_NODE":
    case "REMOVE_EDGE":
      return "remove";
    default:
      return "other";
  }
}

/** One readable line per patch action, in the UI language. */
export function formatActionLabel(action: DiagramPatchAction, translate: TFunction): string {
  switch (action.type) {
    case "ADD_NODE":
      return `${action.payload.name} (${action.payload.nodeType})`;
    case "REMOVE_NODE":
      return translate("llmChat.suggestion.action.removeNode", { nodeId: action.payload.nodeId });
    case "UPDATE_NODE":
      return translate("llmChat.suggestion.action.updateNode", { nodeId: action.payload.nodeId });
    case "ADD_EDGE":
      return action.payload.label || translate("llmChat.suggestion.action.connectionFallback");
    case "REMOVE_EDGE":
      return translate("llmChat.suggestion.action.removeEdge", { edgeId: action.payload.edgeId });
    case "INSERT_PATTERN":
      return translate("llmChat.suggestion.action.insertPattern", {
        patternId: action.payload.patternId,
      });
    case "AUTO_LAYOUT":
      return translate("llmChat.suggestion.action.autoLayout");
    case "GET_TAGS":
      return translate("llmChat.suggestion.action.getTags");
    default:
      return translate("llmChat.suggestion.action.unknown");
  }
}
