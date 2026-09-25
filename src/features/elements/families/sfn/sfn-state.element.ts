import { ArrowRight, CircleCheck, CircleX, Clock, Cog, Diamond, Play } from "lucide-react";
import SfnFlowStateNode, {
  type SfnFlowShape,
} from "@/features/canvas/nodes/SfnNodes/SfnFlowStateNode";
import SfnStateNode from "@/features/canvas/nodes/SfnNodes/SfnStateNode";
import { FLOW_SHAPE_HANDLES, SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { FLOW_DEFAULT_ACCENT } from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { flowExportColours } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import { FLOW_SHAPE_DEFAULT_SIZE } from "@/features/canvas/nodes/ProcessNode/flowShapeGeometry";
import { COMPONENT_TYPE_SFN_STATE } from "@/features/diagram/model/component-type-constants";
import { isSfnStateComponent } from "@/features/diagram/model/component.guards";
import type {
  Component,
  SfnStateComponent,
  SfnStateType,
} from "@/features/diagram/model/component.types";
import { SFN_SERVICES, retryBadge, sfnStateType, taskCaption } from "@/features/diagram/utils/sfn";
import type { ElementCanvasSlice, ElementDescriptor } from "../../element.types";
import { deployBuildData, playbackStyle, skinPatchableKeys } from "../deploy/deploy.shared";
import {
  SFN_ACCENT,
  SFN_CATEGORY_ID,
  SFN_FAMILY_ID,
  SfnInspector,
  retryRepresentation,
} from "./sfn.shared";

const CARD_W = 220;
const CARD_H = 64;

/** The states drawn as the flowchart's shapes, and which shape. */
const FLOW_SHAPE_OF: Partial<Record<SfnStateType, SfnFlowShape>> = {
  Choice: "diamond",
  Succeed: "end",
  Fail: "end",
  Start: "start",
};

/** Each type's default accent: pink states, a green Succeed, a red Fail, a slate start. */
export function sfnStateAccent(stateType: SfnStateType): string {
  if (stateType === "Succeed") return "hsl(var(--node-component))";
  if (stateType === "Fail") return "hsl(var(--destructive))";
  if (stateType === "Start") return FLOW_DEFAULT_ACCENT;
  return SFN_ACCENT;
}

function typeOf(component: Component): SfnStateType {
  return isSfnStateComponent(component) ? sfnStateType(component) : "Task";
}

/** The mono line under a card's name: the Task's service and action, a Wait's seconds. */
export function sfnStateCaption(state: SfnStateComponent): string | undefined {
  const type = sfnStateType(state);
  if (type === "Task") return taskCaption(state) ?? undefined;
  if (type === "Wait")
    return state.waitSeconds !== undefined ? `wait ${state.waitSeconds}s` : "wait";
  if (type === "Pass") return "pass";
  return undefined;
}

function sizeOf(type: SfnStateType): { width: number; height: number } {
  const shape = FLOW_SHAPE_OF[type];
  return shape ? FLOW_SHAPE_DEFAULT_SIZE[shape] : { width: CARD_W, height: CARD_H };
}

/** Choice, Succeed, Fail and Start: the flow node draws them, with its own handles. */
const flowShapedCanvas: ElementCanvasSlice = {
  rfType: "sfn-flow-state",
  component: SfnFlowStateNode,
  handles: FLOW_SHAPE_HANDLES,
  role: "custom-shape",
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  canBeConnectionSource: true,
  derivesSize: false,

  buildData: (comp, ctx) => {
    if (!isSfnStateComponent(comp)) return {};
    const type = sfnStateType(comp);
    return {
      elementId: comp.id,
      name: comp.name,
      description: comp.description,
      flowShape: FLOW_SHAPE_OF[type] ?? "diamond",
      customColor: comp.customColor,
      fill: comp.fill,
      stroke: comp.stroke,
      // The type's accent stands where a lane's would: an unset state wears it.
      laneAccent: sfnStateAccent(type),
      failed: type === "Fail",
      isSelected: ctx.isPlaying
        ? ctx.flowHighlight.activeNodeId === comp.id
        : ctx.selectedNodeId === comp.id,
    };
  },

  buildStyle: (comp, ctx) => {
    const layout = ctx.resolvedNodeLayouts[comp.id];
    const size = sizeOf(typeOf(comp));
    return {
      width: layout?.width ?? size.width,
      height: layout?.height ?? size.height,
      ...playbackStyle(comp, ctx),
    };
  },
};

const PALETTE_TYPES: ReadonlyArray<{ type: SfnStateType; icon: typeof Cog }> = [
  { type: "Task", icon: Cog },
  { type: "Choice", icon: Diamond },
  { type: "Wait", icon: Clock },
  { type: "Pass", icon: ArrowRight },
  { type: "Succeed", icon: CircleCheck },
  { type: "Fail", icon: CircleX },
  { type: "Start", icon: Play },
];

/** A state of a machine: a card for Task, Wait and Pass; the flowchart's shapes for the rest. */
export const sfnStateElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SFN_STATE,
  family: SFN_FAMILY_ID,
  labelKey: "elements.sfn-state.label",
  descriptionKey: "elements.sfn-state.description",

  model: {
    createComponent: (base, options) => ({
      ...base,
      type: COMPONENT_TYPE_SFN_STATE,
      ...(options.sfnStateType && options.sfnStateType !== "Task"
        ? { stateType: options.sfnStateType }
        : {}),
    }),
    defaultSize: (options) => sizeOf(options.sfnStateType ?? "Task"),
    patchableKeys: [
      "stateType",
      "service",
      "action",
      "waitSeconds",
      "errorName",
      "retry",
      ...skinPatchableKeys,
    ],
  },

  canvas: {
    rfType: COMPONENT_TYPE_SFN_STATE,
    component: SfnStateNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isSfnStateComponent(comp)) return {};
      return {
        ...deployBuildData(comp, ctx),
        stateType: sfnStateType(comp),
        service: comp.service,
        caption: sfnStateCaption(comp),
        retry: sfnStateType(comp) === "Task" ? retryBadge(comp.retry) : null,
        defaultAccent: SFN_ACCENT,
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? CARD_W,
        height: layout?.height ?? CARD_H,
        ...playbackStyle(comp, ctx),
      };
    },
  },

  variants: [
    { matches: (comp) => FLOW_SHAPE_OF[typeOf(comp)] !== undefined, canvas: flowShapedCanvas },
  ],

  palette: {
    categoryId: SFN_CATEGORY_ID,
    icon: { kind: "lucide", icon: Cog },
    accent: { kind: "token", cssVar: "--aws-integration" },
    searchKeys: ["step functions", "state", "sfn", "task", "choice", "wait", "pass"],
    variants: PALETTE_TYPES.map(({ type, icon }) => ({
      id: type,
      labelKey: `sfn.stateType.${type}`,
      icon: { kind: "lucide" as const, icon },
      createOptions: type === "Task" ? {} : { sfnStateType: type },
      searchKeys: ["step functions", "sfn", "state", type.toLowerCase()],
    })),
  },

  inspector: { panel: SfnInspector },

  skin: {
    defaultAccent: SFN_ACCENT,
    defaultAccentOf: (comp) => sfnStateAccent(typeOf(comp)),
  },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isSfnStateComponent(comp)) {
          throw new Error(`[elements] sfn-state export received a ${comp.type} component.`);
        }
        const type = sfnStateType(comp);
        const colours = flowExportColours(comp, sfnStateAccent(type));
        const shape = FLOW_SHAPE_OF[type];
        if (shape) {
          // The flowchart's own shapes: rhombus, and the thin and thick ellipses.
          return {
            ...base,
            kind: "flowNode",
            name: type === "Fail" && comp.errorName ? `${comp.name}\n${comp.errorName}` : comp.name,
            description: comp.description || undefined,
            shape,
            ...colours,
          };
        }
        const caption = sfnStateCaption(comp);
        const aws4 = type === "Task" && comp.service ? SFN_SERVICES[comp.service]?.aws4 : undefined;
        const badge = type === "Task" ? retryBadge(comp.retry) : null;
        const representations = [
          ...(badge ? [retryRepresentation(comp.id, badge, base.width)] : []),
          ...(aws4
            ? [
                {
                  id: `${comp.id}-icon`,
                  label: "",
                  x: 8,
                  y: Math.max(0, Math.round((base.height - 22) / 2)),
                  width: 22,
                  height: 22,
                  // draw.io's aws4 resource icon (Sidebar-AWS4.js).
                  shapeStyle: `shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${aws4};`,
                },
              ]
            : []),
        ];
        return {
          ...base,
          kind: "stencil",
          name: comp.name,
          shapeStyle: `rounded=1;arcSize=8;absoluteArcSize=1;align=left;spacingLeft=${aws4 ? 36 : 10};`,
          label: caption ? `${comp.name}\n${caption}` : comp.name,
          ...(representations.length > 0 ? { representations } : {}),
          ...colours,
        };
      },
    },
  },
};
