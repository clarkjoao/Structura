import ApiGroupNode from "../ApiGroupNode";
import { isApiGroupComponent, isApiGroupType, isEndpointType } from "@/features/diagram";
import { computeApiGroupSize } from "../ApiGroupNode/useApiGroupSize";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";

export const apiGroupDescriptor: NodeTypeDescriptor = {
  rfType: "api-group",
  component: ApiGroupNode,
  matches: isApiGroupType,
  zIndex: -1,
  connectable: false,
  canHaveParent: false,
  canBeParent: true,

  buildData: (comp, ctx) => {
    if (!isApiGroupComponent(comp)) return {};

    return {
      elementId: comp.id,
      serviceName: comp.serviceName,
      basePath: comp.basePath,
      protocol: comp.protocol,
      sla: comp.sla,
      isSelected: ctx.selectedNodeId === comp.id,
      controlsDisabled:
        !!ctx.isCompareMode ||
        !!ctx.isPlaying ||
        !!ctx.isRecording ||
        (ctx.selectedNodeIds.size > 0 && !ctx.selectedNodeIds.has(comp.id)),
      onAddEndpoint: ctx.onAddEndpointToGroup ? () => ctx.onAddEndpointToGroup!(comp.id) : undefined,
      ...sceneBadgePropsForNode(ctx, comp.id),
    };
  },

  buildStyle: (comp, ctx) => {
    if (!isApiGroupComponent(comp)) return undefined;
    const endpointCount = Object.values(ctx.resolvedComponents).filter(
      (c) => c.parentId === comp.id && isEndpointType(c.type),
    ).length;
    const { width, height } = computeApiGroupSize(endpointCount);
    return { width, height };
  },
};
