import { HelpCircle } from "lucide-react";
import UnknownNode from "@/features/canvas/nodes/UnknownNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import { COMPONENT_TYPE_UNKNOWN } from "@/features/diagram/model/component-type-constants";
import {
  isPluginTypedComponent,
  isUnknownComponent,
} from "@/features/diagram/model/component.guards";
import i18n from "@/infrastructure/i18n";
import type { ElementDescriptor } from "../element.types";

const UNKNOWN_DEFAULT_W = 240;
const UNKNOWN_DEFAULT_H = 140;

/**
 * The declared type for content Structura cannot interpret.
 *
 * Also the degradation target the canvas falls back to for a plugin-typed
 * component whose plugin is absent — which is why it keeps rendering opaque
 * payloads rather than refusing them. It is *not* the catch-all: an
 * unrecognised type still lands on the C4 descriptor until F9 changes that.
 */
export const unknownElement: ElementDescriptor = {
  id: COMPONENT_TYPE_UNKNOWN,
  family: "structural",
  labelKey: "elements.unknown.label",
  descriptionKey: "elements.unknown.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_UNKNOWN, rawContent: "" }),
    defaultSize: { width: UNKNOWN_DEFAULT_W, height: UNKNOWN_DEFAULT_H },
    patchableKeys: ["rawContent"],
  },

  canvas: {
    rfType: COMPONENT_TYPE_UNKNOWN,
    component: UnknownNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

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
        width: layout?.width ?? UNKNOWN_DEFAULT_W,
        height: layout?.height ?? UNKNOWN_DEFAULT_H,
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: HelpCircle },
    accent: { kind: "neutral" },
    searchKeys: ["unknown", "desconhecido", "raw", "opaque"],
  },

  inspector: {},

  export: {
    drawio: {
      toExportNode: (comp, base) => ({
        ...base,
        kind: "passthrough",
        name: comp.name,
        description: isUnknownComponent(comp) ? comp.rawContent : comp.type,
        originType: comp.type,
        originLabel: i18n.t("elements.unknown.label"),
      }),
    },
  },
};
