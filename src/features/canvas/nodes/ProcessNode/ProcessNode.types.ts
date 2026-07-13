import type { FlowNodeShape } from "@/features/diagram";

export type ProcessNodeData = {
  elementId: string;
  name: string;
  description?: string;
  flowShape: FlowNodeShape;
  nodeColor?: string;
  isSelected?: boolean;
};
