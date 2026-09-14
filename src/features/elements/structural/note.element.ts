import { StickyNote } from "lucide-react";
import NoteNode from "@/features/canvas/nodes/NoteNode";
import { SINGLE_INCOMING_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import {
  NOTE_COLLAPSED_H,
  NOTE_COLLAPSED_W,
  NOTE_DEFAULT_H,
  NOTE_DEFAULT_W,
} from "@/features/canvas/canvas.constants";
import { COMPONENT_TYPE_NOTE } from "@/features/diagram/model/component-type-constants";
import { isNoteComponent } from "@/features/diagram/model/component.guards";
import type { ElementDescriptor } from "../element.types";

/** The note's own light-mode paper colour when the user has not picked one. */
const NOTE_DEFAULT_PAPER = "hsl(45 25% 97%)";

export const noteElement: ElementDescriptor = {
  id: COMPONENT_TYPE_NOTE,
  family: "structural",
  labelKey: "canvasToolbar.note",
  descriptionKey: "elements.note.description",

  model: {
    createComponent: (base) => ({
      ...base,
      type: COMPONENT_TYPE_NOTE,
      panelColor: NOTE_DEFAULT_PAPER,
    }),
    defaultSize: { width: NOTE_DEFAULT_W, height: NOTE_DEFAULT_H },
    patchableKeys: [
      "panelColor",
      "panelColorDark",
      "collapsed",
      "collapsedWidth",
      "collapsedHeight",
    ],
  },

  canvas: {
    rfType: "note",
    component: NoteNode,
    handles: SINGLE_INCOMING_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    // A note is annotated onto something; the arrow runs to it, never out.
    canBeConnectionSource: false,
    // Collapsing swaps the whole box for a small one, but the size still comes
    // from the two constants below — nothing is measured from the text.
    derivesSizeFromContent: false,

    buildData: (comp, ctx) => ({
      elementId: comp.id,
      name: comp.name,
      description: comp.description,
      panelColor: isNoteComponent(comp) ? comp.panelColor : undefined,
      panelColorDark: isNoteComponent(comp) ? comp.panelColorDark : undefined,
      isSelected: ctx.selectedNodeId === comp.id,
      collapsed: isNoteComponent(comp) ? (comp.collapsed ?? false) : false,
      onToggleCollapse: () => ctx.onPanelCollapseToggle?.(comp.id),
      onInlineEditingChange: ctx.setNoteInlineEditingId
        ? (editing: boolean) => ctx.setNoteInlineEditingId!(editing ? comp.id : null)
        : undefined,
      ...sceneBadgePropsForNode(ctx, comp.id),
    }),

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      if (isNoteComponent(comp) && comp.collapsed) {
        return { width: NOTE_COLLAPSED_W, height: NOTE_COLLAPSED_H };
      }
      return {
        width: layout?.width ?? NOTE_DEFAULT_W,
        height: layout?.height ?? NOTE_DEFAULT_H,
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: StickyNote },
    accent: { kind: "neutral" },
    searchKeys: ["note", "nota", "sticky", "postit"],
  },

  // No dedicated panel: a note is edited on the canvas, and the generic
  // ComponentPanel covers the rest.
  inspector: {},

  export: {
    drawio: {
      kind: "note",
      toExportNode: (comp, base) => ({
        ...base,
        kind: "note",
        name: comp.name,
        description: comp.description,
      }),
    },
  },
};
