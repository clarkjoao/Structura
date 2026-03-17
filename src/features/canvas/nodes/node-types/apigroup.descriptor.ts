import ApiGroupNode from "../ApiGroupNode";
import { isApiGroupComponent } from "@/features/diagram";
import { computeApiGroupSize } from "../ApiGroupNode/useApiGroupSize";
import type { NodeTypeDescriptor } from "./types";

export const apiGroupDescriptor: NodeTypeDescriptor = {
  rfType: "api-group",
  component: ApiGroupNode,
  matches: (type) => type === "api-group",
  zIndex: -1,
  connectable: false,
  canHaveParent: false,
  canBeParent: true,

  buildData: (comp, ctx) => {
    if (!isApiGroupComponent(comp)) return {};

    const endpointCount = Object.values(ctx.diagram.snapshot.components).filter(
      (c) => c.parentId === comp.id && c.type === "endpoint",
    ).length;

    return {
      elementId: comp.id,
      serviceName: comp.serviceName,
      basePath: comp.basePath,
      protocol: comp.protocol,
      sla: comp.sla,
      isSelected: ctx.selectedNodeId === comp.id,
      controlsDisabled:
        !ctx.isPlaying &&
        !ctx.isRecording &&
        ctx.selectedNodeIds.size > 0 &&
        !ctx.selectedNodeIds.has(comp.id),
      onAddEndpoint: ctx.onAddEndpointToGroup ? () => ctx.onAddEndpointToGroup!(comp.id) : undefined,
    };
  },

  buildStyle: (comp, ctx) => {
    if (!isApiGroupComponent(comp)) return undefined;
    const endpointCount = Object.values(ctx.diagram.snapshot.components).filter(
      (c) => c.parentId === comp.id && c.type === "endpoint",
    ).length;
    const { width, height } = computeApiGroupSize(endpointCount);
    return { width, height };
  },
};
