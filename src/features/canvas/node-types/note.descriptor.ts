import NoteNode from "../nodes/NoteNode";
import type { NodeTypeDescriptor } from "./types";
import { isNoteComponent } from "@/features/diagram";

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
    panelColor: isNoteComponent(comp) ? comp.panelColor : undefined,
    isSelected: ctx.selectedNodeId === comp.id,
  }),
};
