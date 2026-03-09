import NoteNode from "../nodes/NoteNode";
import type { NodeTypeDescriptor } from "./types";

export const noteDescriptor: NodeTypeDescriptor = {
  rfType: "note",
  component: NoteNode,
  matches: (type) => type === "note",
  zIndex: 1,
  connectable: false,
  canHaveParent: true,
  canBeParent: false,

  buildData: (comp, ctx) => ({
    elementId: comp.id,
    name: comp.name,
    description: comp.description,
    panelColor: comp.panelColor,
    isSelected: ctx.selectedNodeId === comp.id,
  }),
};