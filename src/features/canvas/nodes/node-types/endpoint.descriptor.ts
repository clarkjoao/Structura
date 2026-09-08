import EndpointNode from "../EndpointNode";
import {
  endpointFlows,
  isEndpointComponent,
  isApiGroupComponent,
  isEndpointType,
} from "@/features/diagram";
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

    const calls = ctx.endpointCallsByRoute.get(comp.id) ?? [];

    return {
      // Derived, never kept on the endpoint: the route does not learn who calls
      // it, so deleting a step leaves nothing to clean up.
      callerNames: [...new Set(calls.map((call) => call.flowName))],
      /**
       * What runs through this route: the scripts its handlers implement and
       * the ones whose steps call it. It used to be `handlers[0].flowId` — the
       * first handler and nothing else — falling back to whichever script was
       * being read, which put a play button on every route on the diagram
       * mid-reading, all of them for the same script.
       */
      flows: endpointFlows(comp, ctx.flows, ctx.endpointCallsByRoute),
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
      onPlayFlow: ctx.onPlayFlow,
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
