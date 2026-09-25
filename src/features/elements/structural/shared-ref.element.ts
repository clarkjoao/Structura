import { Link2 } from "lucide-react";
import SharedRefNode from "@/features/canvas/nodes/SharedRefNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { elementAccent } from "@/features/canvas/shared/sharedLayerModel";
import { exportColorHex } from "@/features/canvas/nodes/ProcessNode/flowExportColor";
import { COMPONENT_TYPE_SHARED_REF } from "@/features/diagram/model/component-type-constants";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import { resolveShared } from "@/features/diagram/utils/shared";
import { MAX_HANDLES, MIN_HANDLES } from "@/features/diagram/model/layout.constants";
import { playbackStyle } from "../families/deploy/deploy.shared";
import type { ElementDescriptor } from "../element.types";

const REF_W = 200;
const REF_H = 48;

function clampSlots(count: number): number {
  return Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, count));
}

/** A reference to a shared element, drawn near its consumers. Created from the original, never from the palette. */
export const sharedRefElement: ElementDescriptor = {
  id: COMPONENT_TYPE_SHARED_REF,
  family: "structural",
  labelKey: "elements.shared-ref.label",
  descriptionKey: "elements.shared-ref.description",

  model: {
    createComponent: (base, options) => ({
      ...base,
      type: COMPONENT_TYPE_SHARED_REF,
      refOf: options.refOf ?? "",
    }),
    defaultSize: { width: REF_W, height: REF_H },
    patchableKeys: ["refOf"],
  },

  canvas: {
    rfType: COMPONENT_TYPE_SHARED_REF,
    component: SharedRefNode,
    handles: SPREAD_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isSharedRefComponent(comp)) return {};
      const originalId = resolveShared(comp.id, ctx.resolvedComponents);
      const original = originalId === comp.id ? undefined : ctx.resolvedComponents[originalId];
      const counts = ctx.connectionCounts[comp.id] ?? { incoming: 0, outgoing: 0 };
      return {
        elementId: comp.id,
        name: original?.name ?? comp.name,
        accent: original ? elementAccent(original) : "hsl(var(--muted-foreground))",
        dangling: !original,
        isSelected: ctx.isPlaying
          ? ctx.flowHighlight.litNodeIds.has(comp.id)
          : ctx.selectedNodeId === comp.id,
        incomingCount: clampSlots(counts.incoming),
        outgoingCount: clampSlots(counts.outgoing),
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      // Dimmed or lit with the reading like any card: it lights with its original.
      return {
        width: layout?.width ?? REF_W,
        height: layout?.height ?? REF_H,
        ...playbackStyle(comp, ctx),
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: Link2 },
    accent: { kind: "neutral" },
    searchKeys: ["reference", "ref", "shared", "referência"],
    hidden: true,
  },

  // Selecting a reference inspects its original (the element panel resolves it).
  inspector: {},

  export: {
    drawio: {
      toExportNode: (comp, base, context) => {
        if (!isSharedRefComponent(comp)) {
          throw new Error(`[elements] shared-ref export received a ${comp.type} component.`);
        }
        const components = context?.components ?? { [comp.id]: comp };
        const originalId = resolveShared(comp.id, components);
        const original = originalId === comp.id ? undefined : components[originalId];
        return {
          ...base,
          kind: "stencil",
          name: original?.name ?? comp.name,
          shapeStyle: "rounded=1;arcSize=8;absoluteArcSize=1;",
          label: `${original?.name ?? comp.name} (ref)`,
          accentColor: exportColorHex(original ? elementAccent(original) : "#64748b") ?? "#64748b",
          fill: "none",
          dashed: true,
          // Read back as a reference by the importer.
          metadata: { structuraRefOf: originalId },
        };
      },
    },
  },
};
