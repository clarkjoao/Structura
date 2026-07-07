import type { FlowNodeShape } from "@/features/diagram";

/** @deprecated Use `ProcessNodeData`. Kept as an alias because the React
 * Flow node's `data` field for a process node is structurally identical
 * and external consumers (descriptors, tests) may still import the old
 * name during the migration window. */
export type FlowNodeData = {
  elementId: string;
  name: string;
  description?: string;
  flowShape: FlowNodeShape;
  nodeColor?: string;
  isSelected?: boolean;
};

export type ProcessNodeData = {
  elementId: string;
  name: string;
  description?: string;
  flowShape: FlowNodeShape;
  nodeColor?: string;
  isSelected?: boolean;
};
