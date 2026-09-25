import type { FlowNodeShape, NodeFillMode, NodeStrokeMode } from "@/features/diagram";

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
  fill?: NodeFillMode;
  stroke?: NodeStrokeMode;
  /** The accent of the swimlane it sits in, when that lane passes one on; see `laneAccentFor`. */
  laneAccent?: string;
  isSelected?: boolean;
};
