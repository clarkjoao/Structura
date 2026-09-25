import { Factory } from "lucide-react";
import { createElement } from "react";
import VsmProcessNode from "@/features/canvas/nodes/VsmNodes/VsmProcessNode";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { FLOW_DEFAULT_ACCENT } from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import SkinnedElementPanel from "@/features/canvas/panels/ElementPanel/SkinnedElementPanel";
import { COMPONENT_TYPE_VSM_PROCESS } from "@/features/diagram/model/component-type-constants";
import { isVsmProcessComponent } from "@/features/diagram/model/component.guards";
import i18n from "@/infrastructure/i18n";
import type { ElementDescriptor, ElementInspectorProps } from "../../element.types";
import {
  VSM_CATEGORY_ID,
  VSM_FAMILY_ID,
  VSM_HIDDEN,
  skinBuildData,
  skinPatchableKeys,
} from "./vsm.shared";

const PROCESS_W = 200;
const PROCESS_H = 150;

/** The data box every new process starts with — the classic four, values left blank. */
const DEFAULT_METRIC_KEYS = [
  "vsm.metrics.cycleTime",
  "vsm.metrics.changeover",
  "vsm.metrics.uptime",
  "vsm.metrics.shifts",
] as const;

function VsmProcessInspector(props: ElementInspectorProps) {
  return createElement(SkinnedElementPanel, props);
}

export const vsmProcessElement: ElementDescriptor = {
  id: COMPONENT_TYPE_VSM_PROCESS,
  family: VSM_FAMILY_ID,
  labelKey: "elements.vsm-process.label",
  descriptionKey: "elements.vsm-process.description",

  model: {
    // The rows are written at creation — they are the content the user fills
    // in, labelled in the language the diagram was started in.
    createComponent: (base) => ({
      ...base,
      type: COMPONENT_TYPE_VSM_PROCESS,
      // Ids derived from the component's, so creation stays deterministic.
      metrics: DEFAULT_METRIC_KEYS.map((key, index) => ({
        id: `${base.id}-m${index}`,
        key: i18n.t(key),
        value: "",
      })),
    }),
    defaultSize: { width: PROCESS_W, height: PROCESS_H },
    patchableKeys: ["operators", "metrics", ...skinPatchableKeys],
  },

  canvas: {
    rfType: COMPONENT_TYPE_VSM_PROCESS,
    component: VsmProcessNode,
    handles: SINGLE_PAIR_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isVsmProcessComponent(comp)) return {};
      return { ...skinBuildData(comp, ctx), operators: comp.operators, metrics: comp.metrics };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return { width: layout?.width ?? PROCESS_W, height: layout?.height ?? PROCESS_H };
    },
  },

  palette: {
    categoryId: VSM_CATEGORY_ID,
    hidden: VSM_HIDDEN,
    icon: { kind: "lucide", icon: Factory },
    accent: { kind: "neutral" },
    searchKeys: ["vsm", "process", "processo", "step", "cycle time", "operators"],
  },

  inspector: { panel: VsmProcessInspector },

  skin: { defaultAccent: FLOW_DEFAULT_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isVsmProcessComponent(comp)) {
          throw new Error(`[elements] vsm-process export received a ${comp.type} component.`);
        }
        const rows = (comp.metrics ?? [])
          .filter((metric) => metric.key || metric.value)
          .map((metric) => `${metric.key}: ${metric.value}`);
        const header =
          comp.operators !== undefined ? `${comp.name} (${comp.operators})` : comp.name;
        // Confirmed registered in draw.io's mxLeanMap.js.
        return {
          ...base,
          kind: "stencil",
          name: comp.name,
          shapeStyle:
            "shape=mxgraph.lean_mapping.manufacturing_process;strokeWidth=2;verticalAlign=top;",
          label: [header, ...rows].join("\n"),
          ...flowExportColours(comp, FLOW_DEFAULT_ACCENT),
        };
      },
    },
  },
};
