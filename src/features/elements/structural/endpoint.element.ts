import { Globe } from "lucide-react";
import { createElement } from "react";
import EndpointNode from "@/features/canvas/nodes/EndpointNode";
import EndpointPanel from "@/features/canvas/panels/ElementPanel/EndpointPanel";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import { COMPONENT_TYPE_ENDPOINT } from "@/features/diagram/model/component-type-constants";
import {
  isApiGroupComponent,
  isEndpointComponent,
} from "@/features/diagram/model/component.guards";
import { API_GROUP_ENDPOINT_H, API_GROUP_FRAME_W } from "@/features/diagram/model/layout.constants";
import { endpointFlows } from "@/features/diagram/utils/flow-endpoint";
import { useFlows } from "@/features/diagram/store/selectors/flows.selectors";
import i18n from "@/infrastructure/i18n";
import type { ElementDescriptor, ElementInspectorProps } from "../element.types";

/** Width a standalone endpoint is created at; inside a group the frame decides. */
const ENDPOINT_STANDALONE_W = 260;

/**
 * See `JsonViewerInspector` for the narrowing.
 *
 * `EndpointPanel` also wants the diagram's flows, which the shared inspector
 * contract does not carry — and should not, since no other element needs them.
 * The adapter is a React component, so it reads them itself.
 */
function EndpointInspector(props: ElementInspectorProps) {
  const { component, ...rest } = props;
  const flows = useFlows();
  const availableFlows = flows.map((flow) => ({ id: flow.id, name: flow.name }));
  if (!isEndpointComponent(component)) return null;
  return createElement(EndpointPanel, { component, availableFlows, ...rest });
}

export const endpointElement: ElementDescriptor = {
  id: COMPONENT_TYPE_ENDPOINT,
  family: "structural",
  labelKey: "quickInsert.typeEndpoint",
  descriptionKey: "elements.endpoint.description",

  model: {
    createComponent: (base) => ({
      ...base,
      type: COMPONENT_TYPE_ENDPOINT,
      method: "GET",
      path: i18n.t("canvas.defaultEndpointPath"),
      handlers: [],
    }),
    /**
     * No height on purpose: a standalone endpoint measures itself (its style
     * sets `minHeight` and leaves the rest to the content), and an endpoint
     * dropped into a group never reaches this path at all — the group's
     * insertion writes the row geometry instead.
     */
    defaultSize: { width: ENDPOINT_STANDALONE_W },
    requiredFields: ["method", "path"],
    patchableKeys: ["method", "path", "endpointDescription", "handlers"],
  },

  canvas: {
    rfType: "endpoint",
    component: EndpointNode,
    handles: SINGLE_PAIR_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    /**
     * Size comes from where the endpoint sits, not from what it was created
     * at: a row inside an api-group is exactly one frame-width row, and a
     * standalone one grows to its own content.
     */
    derivesSize: true,

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
        return { width: API_GROUP_FRAME_W, height: API_GROUP_ENDPOINT_H };
      }
      return {
        width: layout?.width ?? ENDPOINT_STANDALONE_W,
        minHeight: 80,
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: Globe },
    accent: { kind: "neutral" },
    searchKeys: ["endpoint", "http", "rest"],
  },

  inspector: {
    panel: EndpointInspector,
  },

  export: {
    drawio: {
      kind: "endpoint",
      toExportNode: (comp, base) => {
        if (!isEndpointComponent(comp)) {
          throw new Error(`[elements] endpoint export received a ${comp.type} component.`);
        }
        return {
          ...base,
          kind: "endpoint",
          method: comp.method,
          path: comp.path,
          endpointDescription: comp.endpointDescription,
        };
      },
    },
  },
};
