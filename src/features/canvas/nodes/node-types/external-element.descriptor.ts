import ExternalElementNode from "../ExternalElementNode";
import type { NodeTypeDescriptor } from "./types";
import { isExternalElementType } from "@/features/diagram";
import type { ExternalElementComponent } from "@/features/diagram";

const EXTERNAL_ELEMENT_W = 220;
const EXTERNAL_ELEMENT_H = 90;

export const externalElementDescriptor: NodeTypeDescriptor = {
  rfType: "external-element",
  component: ExternalElementNode,
  matches: isExternalElementType,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: EXTERNAL_ELEMENT_W, height: EXTERNAL_ELEMENT_H },

  buildData: (comp, ctx) => {
    const ext = comp as ExternalElementComponent;
    const linkedDiagramName =
      ext.linkedDiagramName ??
      (ext.referenceDiagramId ? ctx.allDiagrams[ext.referenceDiagramId]?.name : undefined);

    const canNavigate = !ctx.isPlaying && !ctx.isRecording && !!ext.referenceDiagramId;

    return {
      elementId: comp.id,
      name: comp.name,
      referenceDiagramId: ext.referenceDiagramId,
      linkedElementId: ext.linkedElementId,
      linkedElementName: ext.linkedElementName,
      linkedDiagramName,
      customColor: ext.customColor,
      isSelected: ctx.selectedNodeId === comp.id,
      onOpenInCanvas:
        canNavigate && ctx.navigateToDiagram
          ? () => ctx.navigateToDiagram!(ext.referenceDiagramId, ext.linkedElementId)
          : undefined,
    };
  },

  buildStyle: (_comp, ctx) => {
    const layout = ctx.resolvedNodeLayouts[_comp.id];
    return {
      width: layout?.width ?? EXTERNAL_ELEMENT_W,
      height: layout?.height ?? EXTERNAL_ELEMENT_H,
    };
  },
};
