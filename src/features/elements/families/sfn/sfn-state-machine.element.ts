import { Workflow } from "lucide-react";
import SfnStateMachineNode from "@/features/canvas/nodes/SfnNodes/SfnStateMachineNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import {
  COMPONENT_TYPE_SFN_MAP,
  COMPONENT_TYPE_SFN_PARALLEL,
  COMPONENT_TYPE_SFN_STATE,
  COMPONENT_TYPE_SFN_STATE_MACHINE,
} from "@/features/diagram/model/component-type-constants";
import { isSfnStateMachineComponent } from "@/features/diagram/model/component.guards";
import { sfnStateCount } from "@/features/diagram/utils/sfn";
import i18n from "@/infrastructure/i18n";
import type { ElementDescriptor } from "../../element.types";
import { deployBuildData, playbackStyle, skinPatchableKeys } from "../deploy/deploy.shared";
import {
  SFN_ACCENT,
  SFN_CATEGORY_ID,
  SFN_FAMILY_ID,
  SFN_MACHINE_COMPACT_H,
  SfnInspector,
} from "./sfn.shared";

const MACHINE_W = 640;
const MACHINE_H = 420;

/** What a machine, a Parallel's branch and a Map's iterator hold. */
export const SFN_STATE_TYPES = [
  COMPONENT_TYPE_SFN_STATE,
  COMPONENT_TYPE_SFN_PARALLEL,
  COMPONENT_TYPE_SFN_MAP,
] as const;

/** draw.io's own Step Functions workflow group (Sidebar-AWS4.js). */
export const SFN_WORKFLOW_GROUP_STYLE =
  "shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_step_functions_workflow;verticalAlign=top;spacingLeft=30;";

export const sfnStateMachineElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SFN_STATE_MACHINE,
  family: SFN_FAMILY_ID,
  labelKey: "elements.sfn-state-machine.label",
  descriptionKey: "elements.sfn-state-machine.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_SFN_STATE_MACHINE }),
    defaultSize: { width: MACHINE_W, height: MACHINE_H },
    defaultZIndex: -1,
    patchableKeys: ["workflowType", "xray", "collapsed", ...skinPatchableKeys],
  },

  canvas: {
    rfType: COMPONENT_TYPE_SFN_STATE_MACHINE,
    component: SfnStateMachineNode,
    handles: SPREAD_HANDLES,
    role: "container",
    zIndex: -1,
    connectable: true,
    canHaveParent: true,
    canBeParent: true,
    canBeConnectionSource: true,
    derivesSize: true,
    acceptsChildren: SFN_STATE_TYPES,
    collapsible: true,

    buildData: (comp, ctx) => {
      if (!isSfnStateMachineComponent(comp)) return {};
      return {
        ...deployBuildData(comp, ctx),
        workflowType: comp.workflowType ?? "Standard",
        stateCount: sfnStateCount(comp.id, ctx.resolvedComponents),
        xray: comp.xray === true,
        collapsed: comp.collapsed === true,
        defaultAccent: SFN_ACCENT,
      };
    },

    buildStyle: (comp, ctx) => {
      if (!isSfnStateMachineComponent(comp)) return undefined;
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? MACHINE_W,
        height: comp.collapsed === true ? SFN_MACHINE_COMPACT_H : (layout?.height ?? MACHINE_H),
        ...playbackStyle(comp, ctx),
      };
    },
  },

  palette: {
    categoryId: SFN_CATEGORY_ID,
    icon: { kind: "lucide", icon: Workflow },
    accent: { kind: "token", cssVar: "--aws-integration" },
    searchKeys: ["step functions", "state machine", "sfn", "workflow", "orchestration", "asl"],
  },

  inspector: { panel: SfnInspector },

  skin: { defaultAccent: SFN_ACCENT },

  export: {
    drawio: {
      toExportNode: (comp, base, context) => {
        if (!isSfnStateMachineComponent(comp)) {
          throw new Error(`[elements] sfn-state-machine export received a ${comp.type} component.`);
        }
        const count = context ? sfnStateCount(comp.id, context.components) : 0;
        const chips = [
          comp.workflowType ?? "Standard",
          i18n.t("sfn.states", { lng: "en", count }),
          comp.xray === true ? "X-Ray" : "",
        ].filter(Boolean);
        return {
          ...base,
          kind: "container",
          name: comp.name,
          label: `${comp.name}\n${chips.join(" · ")}`,
          extraStyle: SFN_WORKFLOW_GROUP_STYLE,
          ...(comp.collapsed === true
            ? { compact: { width: base.width, height: SFN_MACHINE_COMPACT_H } }
            : {}),
          ...flowExportColours(comp, SFN_ACCENT),
        };
      },
    },
  },
};
