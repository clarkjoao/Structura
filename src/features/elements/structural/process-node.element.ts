import { Square } from "lucide-react";
import ProcessNode from "@/features/canvas/nodes/ProcessNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { COMPONENT_TYPE_PROCESS_NODE } from "@/features/diagram/model/component-type-constants";
import { isProcessNodeComponent } from "@/features/diagram/model/component.guards";
import type { ElementDescriptor } from "../element.types";

const PROCESS_DEFAULT_W = 160;
const PROCESS_DEFAULT_H = 60;
/** A circle is drawn square so it stays a circle rather than an ellipse. */
const PROCESS_CIRCLE_SIZE = 80;

export const processNodeElement: ElementDescriptor = {
  id: COMPONENT_TYPE_PROCESS_NODE,
  family: "structural",
  labelKey: "nodeTypes.processos",
  descriptionKey: "elements.process-node.description",

  model: {
    createComponent: (base, options) => ({
      ...base,
      type: COMPONENT_TYPE_PROCESS_NODE,
      flowShape: options.flowShape ?? "rectangle",
    }),

    // The shape asked for decides the box: everything is a wide rectangle
    // except a circle, which is square so it does not come out an ellipse.
    defaultSize: (options) =>
      options.flowShape === "circle"
        ? { width: PROCESS_CIRCLE_SIZE, height: PROCESS_CIRCLE_SIZE }
        : { width: PROCESS_DEFAULT_W, height: PROCESS_DEFAULT_H },

    patchableKeys: ["flowShape", "nodeColor"],
  },

  canvas: {
    /**
     * Still `"flow-node"`, not `"process-node"`.
     *
     * The two disagree (§4.5 of the mapping) and aligning them is tempting
     * here, but the React Flow type string is asserted by
     * `useReadDiagramFlow.test.ts` and shares its name with the legacy
     * persisted values `"flow-node"` and `"processos"`, which only disappear
     * in F9. Renaming now would be churn ahead of the migration that makes it
     * meaningful.
     */
    rfType: "flow-node",
    component: ProcessNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    // The nine shapes are drawn inside one component from `flowShape` data;
    // the size still comes from the stored layout.
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isProcessNodeComponent(comp)) return {};
      return {
        elementId: comp.id,
        name: comp.name,
        description: comp.description,
        flowShape: comp.flowShape,
        nodeColor: comp.nodeColor,
        isSelected: ctx.selectedNodeId === comp.id,
      };
    },

    buildStyle: (comp, ctx) => {
      if (!isProcessNodeComponent(comp)) return undefined;
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? PROCESS_DEFAULT_W,
        height: layout?.height ?? PROCESS_DEFAULT_H,
      };
    },
  },

  palette: {
    categoryId: "flowchart",
    icon: { kind: "lucide", icon: Square },
    accent: { kind: "neutral" },
    searchKeys: ["process", "processo", "flowchart", "fluxograma", "step"],
  },

  inspector: {},

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isProcessNodeComponent(comp)) {
          throw new Error(`[elements] process-node export received a ${comp.type} component.`);
        }
        // Its own kind rather than a passthrough: in a flowchart the shape is
        // the meaning, and draw.io has a native style for all nine.
        return {
          ...base,
          kind: "flowNode",
          name: comp.name,
          description: comp.description || undefined,
          shape: comp.flowShape,
          nodeColor: comp.nodeColor,
        };
      },
    },
  },
};
