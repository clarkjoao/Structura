import { Globe } from "lucide-react";
import { createElement } from "react";
import ApiGroupNode from "@/features/canvas/nodes/ApiGroupNode";
import ApiGroupPanel from "@/features/canvas/panels/ElementPanel/ApiGroupPanel";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import { COMPONENT_TYPE_API_GROUP } from "@/features/diagram/model/component-type-constants";
import { isApiGroupComponent } from "@/features/diagram/model/component.guards";
import { isEndpointType } from "@/features/diagram/model/component-type-constants";
import { computeApiGroupSize } from "@/features/diagram/utils/api-group-size";
import { apiGroupFlows } from "@/features/diagram/utils/flow-endpoint";
import type { ElementDescriptor, ElementInspectorProps } from "../element.types";

/** See `JsonViewerInspector`: narrowing here is what keeps the contract cast-free. */
function ApiGroupInspector(props: ElementInspectorProps) {
  const { component, ...rest } = props;
  if (!isApiGroupComponent(component)) return null;
  return createElement(ApiGroupPanel, { component, ...rest });
}

export const apiGroupElement: ElementDescriptor = {
  id: COMPONENT_TYPE_API_GROUP,
  family: "structural",
  labelKey: "quickInsert.typeApiGroup",
  descriptionKey: "elements.api-group.description",

  model: {
    createComponent: (base) => ({
      ...base,
      type: COMPONENT_TYPE_API_GROUP,
      serviceName: base.name,
      basePath: "/api/v1",
      protocol: "REST",
    }),
    // An empty group: header plus footer and nothing between them. Every
    // endpoint added after this grows it — see `derivesSize` below.
    defaultSize: computeApiGroupSize(0),
    // A frame sits behind the endpoints it contains, like a panel.
    defaultZIndex: -1,
    requiredFields: ["serviceName", "basePath", "protocol"],
    patchableKeys: ["serviceName", "basePath", "protocol", "sla"],
  },

  canvas: {
    rfType: "api-group",
    component: ApiGroupNode,
    handles: SPREAD_HANDLES,
    role: "container",
    zIndex: -1,
    // No interactive connecting from the frame — you drag from its endpoints.
    // That is a UI affordance, not a rule about edges: the domain does allow a
    // group to be an edge source, and the handle spec renders the slots for it.
    connectable: false,
    canHaveParent: true,
    canBeParent: true,
    canBeConnectionSource: true,
    /**
     * The height is the number of endpoint children, recomputed on every
     * build — so the group resizes when one is added or removed without
     * anyone writing a layout. `model.defaultSize` is only the empty frame.
     */
    derivesSize: true,

    buildData: (comp, ctx) => {
      if (!isApiGroupComponent(comp)) return {};

      return {
        elementId: comp.id,
        serviceName: comp.serviceName,
        basePath: comp.basePath,
        protocol: comp.protocol,
        sla: comp.sla,
        customColor: (comp as { customColor?: string }).customColor,
        flows: apiGroupFlows(comp.id, ctx.resolvedComponents, ctx.flows, ctx.endpointCallsByRoute),
        onPlayFlow: ctx.onPlayFlow,
        isSelected: ctx.selectedNodeId === comp.id,
        controlsDisabled:
          !!ctx.isCompareMode ||
          (!ctx.isPlaying &&
            !ctx.isRecording &&
            ctx.selectedNodeIds.size > 0 &&
            !ctx.selectedNodeIds.has(comp.id)),
        onAddEndpoint: ctx.onAddEndpointToGroup
          ? () => ctx.onAddEndpointToGroup!(comp.id)
          : undefined,
        ...sceneBadgePropsForNode(ctx, comp.id),
      };
    },

    buildStyle: (comp, ctx) => {
      if (!isApiGroupComponent(comp)) return undefined;
      let endpointCount = 0;
      const childIds = ctx.childrenIndex.get(comp.id);
      if (childIds) {
        for (const childId of childIds) {
          const child = ctx.resolvedComponents[childId];
          if (child && isEndpointType(child.type)) endpointCount++;
        }
      }
      const { width, height } = computeApiGroupSize(endpointCount);
      return { width, height };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: Globe },
    accent: { kind: "neutral" },
    searchKeys: ["api", "group", "grupo", "openapi"],
  },

  inspector: {
    panel: ApiGroupInspector,
  },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isApiGroupComponent(comp)) {
          throw new Error(`[elements] api-group export received a ${comp.type} component.`);
        }
        return {
          ...base,
          kind: "apiGroup",
          serviceName: comp.serviceName,
          basePath: comp.basePath,
          protocol: comp.protocol,
        };
      },
    },
  },
};
