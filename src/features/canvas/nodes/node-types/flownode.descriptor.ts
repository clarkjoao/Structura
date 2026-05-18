import FlowNode from "../FlowNode";
import type { NodeTypeDescriptor } from "./types";
import {
  isFlowNodeComponent,
  isFlowNodeType,
} from "@/features/diagram";

export const flowNodeDescriptor: NodeTypeDescriptor = {
  rfType: "flow-node",
  component: FlowNode,
  matches: isFlowNodeType,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: 160, height: 60 },

  buildData: (comp, ctx) => {
    if (!isFlowNodeComponent(comp)) return {};
    return {
      elementId: comp.id,
      name: comp.name,
      description: comp.description,
      flowShape: comp.flowShape,
      nodeColor: comp.nodeColor,
      isSelected: ctx.selectedNodeId === comp.id,
    };
  },

  buildStyle: (comp, ctx) => {
    if (!isFlowNodeComponent(comp)) return undefined;
    const layout = ctx.resolvedNodeLayouts[comp.id];
    return {
      width: layout?.width ?? 160,
      height: layout?.height ?? 60,
    };
  },
};
