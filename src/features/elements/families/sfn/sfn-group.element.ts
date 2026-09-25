import { Repeat, Split } from "lucide-react";
import SfnGroupNode from "@/features/canvas/nodes/SfnNodes/SfnGroupNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import {
  COMPONENT_TYPE_SFN_MAP,
  COMPONENT_TYPE_SFN_PARALLEL,
} from "@/features/diagram/model/component-type-constants";
import {
  isSfnMapComponent,
  isSfnParallelComponent,
} from "@/features/diagram/model/component.guards";
import { parallelBranches } from "@/features/diagram/utils/sfn";
import type { ElementDescriptor } from "../../element.types";
import { deployBuildData, playbackStyle, skinPatchableKeys } from "../deploy/deploy.shared";
import { SFN_STATE_TYPES } from "./sfn-state-machine.element";
import { SFN_ACCENT, SFN_CATEGORY_ID, SFN_FAMILY_ID, SfnInspector } from "./sfn.shared";

const GROUP_W = 420;
const GROUP_H = 220;

function groupStyle(
  comp: Parameters<typeof playbackStyle>[0],
  ctx: Parameters<typeof playbackStyle>[1],
) {
  const layout = ctx.resolvedNodeLayouts[comp.id];
  return {
    width: layout?.width ?? GROUP_W,
    height: layout?.height ?? GROUP_H,
    ...playbackStyle(comp, ctx),
  };
}

const groupCanvas = {
  handles: SPREAD_HANDLES,
  role: "container" as const,
  zIndex: 0,
  connectable: true,
  canHaveParent: true,
  canBeParent: true,
  canBeConnectionSource: true,
  derivesSize: false,
  acceptsChildren: SFN_STATE_TYPES,
  buildStyle: groupStyle,
};

/** A Parallel state: its branches run side by side inside it. */
export const sfnParallelElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SFN_PARALLEL,
  family: SFN_FAMILY_ID,
  labelKey: "elements.sfn-parallel.label",
  descriptionKey: "elements.sfn-parallel.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_SFN_PARALLEL }),
    defaultSize: { width: GROUP_W, height: GROUP_H },
    patchableKeys: ["retry", ...skinPatchableKeys],
  },

  canvas: {
    ...groupCanvas,
    rfType: COMPONENT_TYPE_SFN_PARALLEL,
    component: SfnGroupNode,
    buildData: (comp, ctx) => {
      if (!isSfnParallelComponent(comp)) return {};
      return {
        ...deployBuildData(comp, ctx),
        kind: "Parallel",
        dividers: parallelBranches(comp.id, ctx.resolvedComponents, ctx.resolvedNodeLayouts)
          .dividers,
        defaultAccent: SFN_ACCENT,
      };
    },
  },

  palette: {
    categoryId: SFN_CATEGORY_ID,
    icon: { kind: "lucide", icon: Split },
    accent: { kind: "token", cssVar: "--aws-integration" },
    searchKeys: ["step functions", "sfn", "parallel", "branches", "paralelo"],
  },

  inspector: { panel: SfnInspector },
  skin: { defaultAccent: SFN_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base, context) => {
        if (!isSfnParallelComponent(comp)) {
          throw new Error(`[elements] sfn-parallel export received a ${comp.type} component.`);
        }
        const { dividers } = context
          ? parallelBranches(comp.id, context.components, context.layouts)
          : { dividers: [] };
        return {
          ...base,
          kind: "container",
          name: comp.name,
          label: `Parallel · ${comp.name}`,
          // The branch dividers, as thin dashed cells: representations, not nodes.
          representations: dividers.map((x, index) => ({
            id: `${comp.id}-branch-${index}`,
            label: "",
            x,
            y: 36,
            width: 1,
            height: Math.max(0, base.height - 44),
            fillOpacity: 45,
          })),
          ...flowExportColours(comp, SFN_ACCENT),
          dashed: true,
        };
      },
    },
  },
};

/** A Map state: its iterator's states, run once per item. */
export const sfnMapElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SFN_MAP,
  family: SFN_FAMILY_ID,
  labelKey: "elements.sfn-map.label",
  descriptionKey: "elements.sfn-map.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_SFN_MAP }),
    defaultSize: { width: GROUP_W, height: GROUP_H },
    patchableKeys: ["itemsPath", "maxConcurrency", "retry", ...skinPatchableKeys],
  },

  canvas: {
    ...groupCanvas,
    rfType: COMPONENT_TYPE_SFN_MAP,
    component: SfnGroupNode,
    buildData: (comp, ctx) => {
      if (!isSfnMapComponent(comp)) return {};
      return {
        ...deployBuildData(comp, ctx),
        kind: "Map",
        dividers: [],
        itemsPath: comp.itemsPath,
        maxConcurrency: comp.maxConcurrency,
        defaultAccent: SFN_ACCENT,
      };
    },
  },

  palette: {
    categoryId: SFN_CATEGORY_ID,
    icon: { kind: "lucide", icon: Repeat },
    accent: { kind: "token", cssVar: "--aws-integration" },
    searchKeys: ["step functions", "sfn", "map", "iterator", "foreach", "items"],
  },

  inspector: { panel: SfnInspector },
  skin: { defaultAccent: SFN_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isSfnMapComponent(comp)) {
          throw new Error(`[elements] sfn-map export received a ${comp.type} component.`);
        }
        const chips = [
          comp.itemsPath,
          comp.maxConcurrency !== undefined ? `max ${comp.maxConcurrency}` : "",
        ].filter(Boolean);
        return {
          ...base,
          kind: "container",
          name: comp.name,
          label: [`Map · ${comp.name}`, chips.join(" · ")].filter(Boolean).join("\n"),
          // Its iterator runs per item: a stack, exported as a shadow.
          stacked: true,
          ...flowExportColours(comp, SFN_ACCENT),
          dashed: true,
        };
      },
    },
  },
};
