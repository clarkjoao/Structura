import SvgNode from "../SvgNode";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";
import { isSvgComponentType, isSvgComponent } from "@/features/diagram";

export const svgDescriptor: NodeTypeDescriptor = {
  rfType: "svg",
  component: SvgNode,
  matches: isSvgComponentType,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: 200, height: 200 },

  buildData: (comp, ctx) => {
    if (!isSvgComponent(comp)) return {};
    return {
      elementId: comp.id,
      name: comp.name,
      svgContent: comp.svgContent,
      isSelected: ctx.selectedNodeId === comp.id,
      ...sceneBadgePropsForNode(ctx, comp.id),
    };
  },

  buildStyle: (comp, ctx) => {
    const layout = ctx.resolvedNodeLayouts[comp.id];
    return {
      width: layout?.width ?? 200,
      height: layout?.height ?? 200,
    };
  },
};
