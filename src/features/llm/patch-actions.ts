import type { DiagramPatchAction } from "./types";

export type AddNodeAction = Extract<DiagramPatchAction, { type: "ADD_NODE" }>;
export type AddEdgeAction = Extract<DiagramPatchAction, { type: "ADD_EDGE" }>;
export type AutoLayoutAction = Extract<DiagramPatchAction, { type: "AUTO_LAYOUT" }>;

export function isAddNodeAction(action: DiagramPatchAction): action is AddNodeAction {
  return action.type === "ADD_NODE";
}

export function isAddEdgeAction(action: DiagramPatchAction): action is AddEdgeAction {
  return action.type === "ADD_EDGE";
}

export function isAutoLayoutAction(action: DiagramPatchAction): action is AutoLayoutAction {
  return action.type === "AUTO_LAYOUT";
}
