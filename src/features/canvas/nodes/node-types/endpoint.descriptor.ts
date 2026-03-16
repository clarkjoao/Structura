import EndpointNode from "../EndpointNode";
import { isEndpointComponent } from "@/features/diagram";
import type { NodeTypeDescriptor } from "./types";

export const endpointDescriptor: NodeTypeDescriptor = {
  rfType: "endpoint",
  component: EndpointNode,
  matches: (type) => type === "endpoint",
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: 260, height: 120 },

  buildData: (comp, ctx) => {
    if (!isEndpointComponent(comp)) return {};

    const allFlows = Object.values(ctx.diagram.snapshot.flows);

    return {
      elementId: comp.id,
      method: comp.method,
      path: comp.path,
      description: comp.endpointDescription ?? comp.description,
      handlers: comp.handlers ?? [],
      isSelected: ctx.selectedNodeId === comp.id,
      controlsDisabled:
        !ctx.isPlaying &&
        !ctx.isRecording &&
        ctx.selectedNodeIds.size > 0 &&
        !ctx.selectedNodeIds.has(comp.id),
      isPlaying: ctx.isPlaying,
      activeFlowId: ctx.activeFlowId ?? null,
      availableFlows: allFlows.map((f) => ({ id: f.id, name: f.name })),
      onPlayHandler: ctx.onPlayFlow
        ? (flowId: string) => ctx.onPlayFlow!(flowId)
        : undefined,
    };
  },

  buildStyle: (comp, ctx) => {
    const layout = ctx.diagram.nodeLayouts[comp.id];
    return {
      width: layout?.width ?? 260,
      minHeight: 80,
    };
  },
};
