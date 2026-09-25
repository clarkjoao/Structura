import type { FlowNodeShape } from "@/features/diagram";

export type ProcessNodeData = {
  elementId: string;
  name: string;
  description?: string;
  flowShape: FlowNodeShape;
  /** Accent, as stored; absent resolves to the family default at render. */
  customColor?: string;
  /** Legacy whole-body colour; see `ProcessNodeComponent.nodeColor`. */
  nodeColor?: string;
  technology?: string;
  isSelected?: boolean;
};
