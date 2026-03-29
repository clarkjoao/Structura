import NoteNode from "../NoteNode";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";
import { isNoteComponent, isNoteType } from "@/features/diagram";
import {
  NOTE_COLLAPSED_H,
  NOTE_COLLAPSED_W,
  NOTE_DEFAULT_W,
  NOTE_DEFAULT_H,
} from "../../constants";

export const noteDescriptor: NodeTypeDescriptor = {
  rfType: "note",
  component: NoteNode,
  matches: isNoteType,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: NOTE_DEFAULT_W, height: NOTE_DEFAULT_H },

  buildData: (comp, ctx) => ({
    elementId: comp.id,
    name: comp.name,
    description: comp.description,
    panelColor: isNoteComponent(comp) ? comp.panelColor : undefined,
    isSelected: ctx.selectedNodeId === comp.id,
    collapsed: isNoteComponent(comp) ? (comp.collapsed ?? false) : false,
    onToggleCollapse: () => ctx.onPanelCollapseToggle?.(comp.id),
    onStartEdit: ctx.onNoteStartEdit
      ? () => ctx.onNoteStartEdit!(comp.id)
      : undefined,
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
};
