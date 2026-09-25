import { Factory, Warehouse } from "lucide-react";
import { createElement } from "react";
import VsmExternalNode from "@/features/canvas/nodes/VsmNodes/VsmExternalNode";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { FLOW_DEFAULT_ACCENT } from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import SkinnedElementPanel from "@/features/canvas/panels/ElementPanel/SkinnedElementPanel";
import { COMPONENT_TYPE_VSM_EXTERNAL } from "@/features/diagram/model/component-type-constants";
import { isVsmExternalComponent } from "@/features/diagram/model/component.guards";
import type { ElementDescriptor, ElementInspectorProps } from "../../element.types";
import {
  VSM_CATEGORY_ID,
  VSM_FAMILY_ID,
  VSM_HIDDEN,
  skinBuildData,
  skinPatchableKeys,
} from "./vsm.shared";

const EXTERNAL_W = 150;
const EXTERNAL_H = 96;

function VsmExternalInspector(props: ElementInspectorProps) {
  return createElement(SkinnedElementPanel, props);
}

/**
 * Supplier / customer — one element with a `role`, offered as two palette
 * entries. The role is data (the inspector switches it), not a second type.
 */
export const vsmExternalElement: ElementDescriptor = {
  id: COMPONENT_TYPE_VSM_EXTERNAL,
  family: VSM_FAMILY_ID,
  labelKey: "elements.vsm-external.label",
  descriptionKey: "elements.vsm-external.description",

  model: {
    createComponent: (base, options) => ({
      ...base,
      type: COMPONENT_TYPE_VSM_EXTERNAL,
      // Supplier is the default and is not written.
      ...(options.vsmRole === "customer" ? { role: "customer" as const } : {}),
    }),
    defaultSize: { width: EXTERNAL_W, height: EXTERNAL_H },
    patchableKeys: ["role", ...skinPatchableKeys],
  },

  canvas: {
    rfType: COMPONENT_TYPE_VSM_EXTERNAL,
    component: VsmExternalNode,
    handles: SINGLE_PAIR_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isVsmExternalComponent(comp)) return {};
      return { ...skinBuildData(comp, ctx), role: comp.role };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return { width: layout?.width ?? EXTERNAL_W, height: layout?.height ?? EXTERNAL_H };
    },
  },

  palette: {
    categoryId: VSM_CATEGORY_ID,
    hidden: VSM_HIDDEN,
    icon: { kind: "lucide", icon: Factory },
    accent: { kind: "neutral" },
    searchKeys: ["vsm", "supplier", "customer", "fornecedor", "cliente", "factory", "fábrica"],
    variants: [
      {
        id: "supplier",
        labelKey: "vsm.role.supplier",
        icon: { kind: "lucide", icon: Factory },
        createOptions: { vsmRole: "supplier" },
        searchKeys: ["vsm", "supplier", "fornecedor", "outside source"],
      },
      {
        id: "customer",
        labelKey: "vsm.role.customer",
        icon: { kind: "lucide", icon: Warehouse },
        createOptions: { vsmRole: "customer" },
        searchKeys: ["vsm", "customer", "cliente", "outside source"],
      },
    ],
  },

  inspector: { panel: VsmExternalInspector },

  skin: { defaultAccent: FLOW_DEFAULT_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isVsmExternalComponent(comp)) {
          throw new Error(`[elements] vsm-external export received a ${comp.type} component.`);
        }
        // Confirmed registered in draw.io's mxLeanMap.js.
        return {
          ...base,
          kind: "stencil",
          name: comp.name,
          shapeStyle: "shape=mxgraph.lean_mapping.outside_sources;strokeWidth=2;",
          label: comp.name,
          ...flowExportColours(comp, FLOW_DEFAULT_ACCENT),
        };
      },
    },
  },
};
