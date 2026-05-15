import type { FlowNodeShape } from "@/features/diagram";

export interface FlowNodeData {
  elementId: string;
  name: string;
  description?: string;
  flowShape: FlowNodeShape;
  nodeColor?: string;
  isSelected?: boolean;
}
