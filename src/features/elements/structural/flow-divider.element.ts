import { Minus, SeparatorHorizontal } from "lucide-react";
import { createElement } from "react";
import FlowDividerNode from "@/features/canvas/nodes/FlowDividerNode";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import VsmPanel from "@/features/canvas/panels/ElementPanel/VsmPanel";
import { COMPONENT_TYPE_FLOW_DIVIDER } from "@/features/diagram/model/component-type-constants";
import { isFlowDividerComponent } from "@/features/diagram/model/component.guards";
import type { ElementDescriptor, ElementInspectorProps } from "../element.types";

const DIVIDER_W = 800;
const DIVIDER_H = 24;

function FlowDividerInspector(props: ElementInspectorProps) {
  return createElement(VsmPanel, props);
}

/**
 * A named line: its own element, not part of a lane, so it can cross any
 * diagram. Offered with the three service-blueprint lines as presets — the
 * line of visibility starting dashed.
 */
export const flowDividerElement: ElementDescriptor = {
  id: COMPONENT_TYPE_FLOW_DIVIDER,
  family: "structural",
  labelKey: "elements.flow-divider.label",
  descriptionKey: "elements.flow-divider.description",

  model: {
    createComponent: (base, options) => ({
      ...base,
      type: COMPONENT_TYPE_FLOW_DIVIDER,
      // Solid is the default and is not written.
      ...(options.stroke === "dashed" ? { stroke: "dashed" as const } : {}),
    }),
    defaultSize: { width: DIVIDER_W, height: DIVIDER_H },
    patchableKeys: ["stroke"],
  },

  canvas: {
    rfType: COMPONENT_TYPE_FLOW_DIVIDER,
    component: FlowDividerNode,
    handles: SINGLE_PAIR_HANDLES,
    role: "custom-shape",
    zIndex: 0,
    connectable: false,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isFlowDividerComponent(comp)) return {};
      return {
        elementId: comp.id,
        name: comp.name,
        stroke: comp.stroke,
        isSelected: ctx.selectedNodeId === comp.id,
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      // Only the width is the user's: the height is the label chip's.
      return { width: layout?.width ?? DIVIDER_W, height: DIVIDER_H };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: SeparatorHorizontal },
    accent: { kind: "neutral" },
    searchKeys: ["line", "linha", "divider", "separator", "blueprint"],
    variants: [
      {
        id: "interaction",
        labelKey: "blueprint.lines.interaction",
        icon: { kind: "lucide", icon: Minus },
        createOptions: {},
        searchKeys: ["line", "linha", "interaction", "interação", "blueprint"],
      },
      {
        id: "visibility",
        labelKey: "blueprint.lines.visibility",
        icon: { kind: "lucide", icon: SeparatorHorizontal },
        createOptions: { stroke: "dashed" },
        searchKeys: ["line", "linha", "visibility", "visibilidade", "blueprint"],
      },
      {
        id: "internal",
        labelKey: "blueprint.lines.internal",
        icon: { kind: "lucide", icon: Minus },
        createOptions: {},
        searchKeys: ["line", "linha", "internal", "interna", "blueprint"],
      },
    ],
  },

  inspector: { panel: FlowDividerInspector },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isFlowDividerComponent(comp)) {
          throw new Error(`[elements] flow-divider export received a ${comp.type} component.`);
        }
        // draw.io's built-in line shape; the label sits at its left end.
        return {
          ...base,
          kind: "stencil",
          name: comp.name,
          shapeStyle:
            "line;strokeWidth=1.5;align=left;verticalAlign=middle;spacingLeft=4;" +
            "fontFamily=monospace;fontSize=10;labelBackgroundColor=#ffffff;",
          label: comp.name.toUpperCase(),
          ...flowExportColours({ stroke: comp.stroke }),
        };
      },
    },
  },
};
