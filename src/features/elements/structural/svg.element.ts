import { Shapes } from "lucide-react";
import { createElement } from "react";
import SvgNode from "@/features/canvas/nodes/SvgNode";
import SvgPanel from "@/features/canvas/panels/ElementPanel/SvgPanel";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import { COMPONENT_TYPE_SVG } from "@/features/diagram/model/component-type-constants";
import { DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import { isSvgComponent } from "@/features/diagram/model/component.guards";
import type { ElementDescriptor, ElementInspectorProps } from "../element.types";

/** Square card-width default — same floor paste/drop uses for tiny icons. */
const SVG_DEFAULT_W = DEFAULT_NODE_W;
const SVG_DEFAULT_H = DEFAULT_NODE_W;

/**
 * The artwork as a data: URI draw.io can render.
 *
 * `svgContent` is sanitised on the way in (`canvas/utils/svg.sanitizer`), so
 * what is encoded here is already the cleaned markup, never arbitrary input.
 * Encoded with `btoa` over UTF-8 bytes, because an SVG may carry non-ASCII
 * text and `btoa` alone would throw on it.
 */
function toSvgDataUri(svgContent: string): string {
  const utf8 = new TextEncoder().encode(svgContent);
  let binary = "";
  for (const byte of utf8) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function SvgInspector(props: ElementInspectorProps) {
  const { component, ...rest } = props;
  if (!isSvgComponent(component)) return null;
  return createElement(SvgPanel, { component, ...rest });
}

export const svgElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SVG,
  family: "structural",
  labelKey: "elements.svg.label",
  descriptionKey: "elements.svg.description",

  model: {
    createComponent: (base) => ({
      ...base,
      type: COMPONENT_TYPE_SVG,
      svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>',
      showBorder: true,
    }),
    defaultSize: { width: SVG_DEFAULT_W, height: SVG_DEFAULT_H },
    patchableKeys: ["svgContent", "showBorder", "customColor"],
  },

  canvas: {
    rfType: COMPONENT_TYPE_SVG,
    component: SvgNode,
    handles: SINGLE_PAIR_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isSvgComponent(comp)) return {};
      return {
        elementId: comp.id,
        name: comp.name,
        svgContent: comp.svgContent,
        showBorder: comp.showBorder,
        customColor: comp.customColor,
        isSelected: ctx.selectedNodeId === comp.id,
        ...sceneBadgePropsForNode(ctx, comp.id),
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? SVG_DEFAULT_W,
        height: layout?.height ?? SVG_DEFAULT_H,
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: Shapes },
    accent: { kind: "neutral" },
    searchKeys: ["svg", "image", "imagem", "vector", "vetor", "art", "arte", "png", "jpg"],
  },

  inspector: {
    panel: SvgInspector,
  },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isSvgComponent(comp)) {
          throw new Error(`[elements] svg export received a ${comp.type} component.`);
        }
        return {
          ...base,
          kind: "image",
          name: comp.name,
          dataUri: toSvgDataUri(comp.svgContent),
        };
      },
    },
  },
};
