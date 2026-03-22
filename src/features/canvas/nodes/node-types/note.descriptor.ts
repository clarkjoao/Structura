import NoteNode from "../NoteNode";
import type { NodeTypeDescriptor } from "./types";
import { isNoteComponent, isNoteType } from "@/features/diagram";
import { NOTE_DEFAULT_W, NOTE_DEFAULT_H } from "../../constants";

export const noteDescriptor: NodeTypeDescriptor = {
  rfType: "note",
  component: NoteNode,
  matches: isNoteType,
  zIndex: 1,
  connectable: false,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: NOTE_DEFAULT_W, height: NOTE_DEFAULT_H },

  buildData: (comp, ctx) => ({
    elementId: comp.id,
    name: comp.name,
    description: comp.description,
    panelColor: isNoteComponent(comp) ? comp.panelColor : undefined,
    isSelected: ctx.selectedNodeId === comp.id,
    ...(ctx.sceneBadgeByComponentId[comp.id]
      ? { sceneBadge: ctx.sceneBadgeByComponentId[comp.id] }
      : {}),
  }),

  buildStyle: (comp, ctx) => {
    const layout = ctx.resolvedNodeLayouts[comp.id];
    return {
      width: layout?.width ?? NOTE_DEFAULT_W,
      height: layout?.height ?? NOTE_DEFAULT_H,
    };
  },
};
