import UnknownNode from "../UnknownNode";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";
import { isUnknownType, isUnknownComponent, isPluginTypedComponent } from "@/features/diagram";

export const unknownDescriptor: NodeTypeDescriptor = {
  rfType: "unknown",
  component: UnknownNode,
  matches: isUnknownType,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: 240, height: 140 },

  buildData: (comp, ctx) => {
    // Also the degradation target for plugin-typed components whose plugin is absent:
    // show the name and the namespaced type, never touch the persisted data.
    if (isPluginTypedComponent(comp)) {
      return {
        elementId: comp.id,
        name: comp.name,
        rawContent: comp.type,
        isSelected: ctx.selectedNodeId === comp.id,
        ...sceneBadgePropsForNode(ctx, comp.id),
      };
    }
    if (!isUnknownComponent(comp)) return {};
    return {
      elementId: comp.id,
      name: comp.name,
      rawContent: comp.rawContent,
      isSelected: ctx.selectedNodeId === comp.id,
      ...sceneBadgePropsForNode(ctx, comp.id),
    };
  },

  buildStyle: (comp, ctx) => {
    const layout = ctx.resolvedNodeLayouts[comp.id];
    return {
      width: layout?.width ?? 240,
      height: layout?.height ?? 140,
    };
  },
};
