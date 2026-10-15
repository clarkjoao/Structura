import { Type } from "lucide-react";
import TextNode from "@/features/canvas/nodes/TextNode";
import { NO_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { COMPONENT_TYPE_TEXT } from "@/features/diagram/model/component-type-constants";
import { isTextComponent } from "@/features/diagram/model/component.guards";
import type { ElementDescriptor } from "../element.types";

const TEXT_DEFAULT_W = 280;
const TEXT_DEFAULT_H = 48;

/**
 * Free text for planning: a heading or a caption on the canvas. A decoration —
 * it has no handles, takes no edges and stays out of autolayout — and it is
 * drawn only while the diagram's text layer is on (`Diagram.textsVisible`).
 */
export const textElement: ElementDescriptor = {
  id: COMPONENT_TYPE_TEXT,
  family: "structural",
  labelKey: "elements.text.label",
  descriptionKey: "elements.text.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_TEXT }),
    defaultSize: { width: TEXT_DEFAULT_W, height: TEXT_DEFAULT_H },
    patchableKeys: ["textSize", "bold", "italic", "textColor"],
  },

  canvas: {
    rfType: COMPONENT_TYPE_TEXT,
    component: TextNode,
    handles: NO_HANDLES,
    role: "custom-shape",
    zIndex: 2,
    connectable: false,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: false,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isTextComponent(comp)) return {};
      return {
        elementId: comp.id,
        name: comp.name,
        textSize: comp.textSize,
        bold: comp.bold,
        italic: comp.italic,
        textColor: comp.textColor,
        isSelected: ctx.selectedNodeId === comp.id,
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? TEXT_DEFAULT_W,
        height: layout?.height ?? TEXT_DEFAULT_H,
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: Type },
    accent: { kind: "neutral" },
    searchKeys: ["text", "texto", "title", "título", "heading", "caption", "legenda"],
  },

  inspector: {},

  export: {
    drawio: {
      toExportNode: (comp, base) => ({
        ...base,
        kind: "note",
        name: comp.name,
        description: "",
      }),
    },
  },
};
