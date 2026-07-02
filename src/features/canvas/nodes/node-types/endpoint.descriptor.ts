import EndpointNode from "../EndpointNode";
import { isEndpointComponent, isApiGroupComponent, isEndpointType } from "@/features/diagram";
import { ENDPOINT_H, FRAME_W } from "../ApiGroupNode/constants";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";

export const endpointDescriptor: NodeTypeDescriptor = {
  rfType: "endpoint",
  component: EndpointNode,
  matches: isEndpointType,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: 260, height: 120 },

  buildData: (comp, ctx) => {
    if (!isEndpointComponent(comp)) return {};

    const allFlows = ctx.flows;

    return {
      elementId: comp.id,
      method: comp.method,
      path: comp.path,
      description: comp.endpointDescription ?? comp.description,
      handlers: comp.handlers ?? [],
      isSelected: ctx.selectedNodeId === comp.id,
      controlsDisabled:
        !!ctx.isCompareMode ||
        (!ctx.isPlaying &&
          !ctx.isRecording &&
          ctx.selectedNodeIds.size > 0 &&
          !ctx.selectedNodeIds.has(comp.id)),
      isPlaying: ctx.isCompareMode ? false : ctx.isPlaying,
      activeFlowId: ctx.activeFlowId ?? comp.handlers?.[0]?.flowId ?? null,
      availableFlows: allFlows.map((f) => ({ id: f.id, name: f.name })),
      onPlayHandler: ctx.onPlayFlow ? (flowId: string) => ctx.onPlayFlow!(flowId) : undefined,
      ...sceneBadgePropsForNode(ctx, comp.id),
    };
  },

  buildStyle: (comp, ctx) => {
    if (!isEndpointComponent(comp)) return undefined;
    const layout = ctx.resolvedNodeLayouts[comp.id];
    if (comp.parentId && isApiGroupComponent(ctx.resolvedComponents[comp.parentId])) {
      return { width: FRAME_W, height: ENDPOINT_H };
    }
    return {
      width: layout?.width ?? 260,
      minHeight: 80,
    };
  },
};
