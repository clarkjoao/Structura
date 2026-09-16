import { ExternalLink } from "lucide-react";
import { createElement } from "react";
import ExternalElementNode from "@/features/canvas/nodes/ExternalElementNode";
import ExternalElementPanel from "@/features/canvas/panels/ElementPanel/ExternalElementPanel";
import { SINGLE_PAIR_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { COMPONENT_TYPE_EXTERNAL_ELEMENT } from "@/features/diagram/model/component-type-constants";
import { isExternalElementComponent } from "@/features/diagram/model/component.guards";
import i18n from "@/infrastructure/i18n";
import type { ElementDescriptor, ElementInspectorProps } from "../element.types";

const EXTERNAL_ELEMENT_W = 220;
const EXTERNAL_ELEMENT_H = 90;

/** See `JsonViewerInspector`: narrowing here is what keeps the contract cast-free. */
function ExternalElementInspector(props: ElementInspectorProps) {
  const { component, ...rest } = props;
  if (!isExternalElementComponent(component)) return null;
  return createElement(ExternalElementPanel, { component, ...rest });
}

export const externalElementElement: ElementDescriptor = {
  id: COMPONENT_TYPE_EXTERNAL_ELEMENT,
  family: "structural",
  labelKey: "quickInsert.typeExternalElement",
  descriptionKey: "elements.external-element.description",

  model: {
    createComponent: (base) => ({
      ...base,
      type: COMPONENT_TYPE_EXTERNAL_ELEMENT,
      referenceDiagramId: "",
      tags: ["external"],
    }),
    defaultSize: { width: EXTERNAL_ELEMENT_W, height: EXTERNAL_ELEMENT_H },
    patchableKeys: [
      "referenceDiagramId",
      "linkedElementId",
      "linkedElementName",
      "linkedDiagramName",
      "customColor",
    ],
  },

  canvas: {
    rfType: COMPONENT_TYPE_EXTERNAL_ELEMENT,
    component: ExternalElementNode,
    handles: SINGLE_PAIR_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    canBeConnectionSource: true,
    derivesSize: false,

    buildData: (comp, ctx) => {
      if (!isExternalElementComponent(comp)) return {};
      const linkedDiagramName =
        comp.linkedDiagramName ??
        (comp.referenceDiagramId ? ctx.allDiagrams[comp.referenceDiagramId]?.name : undefined);

      const canNavigate = !ctx.isPlaying && !ctx.isRecording && !!comp.referenceDiagramId;

      return {
        elementId: comp.id,
        name: comp.name,
        referenceDiagramId: comp.referenceDiagramId,
        linkedElementId: comp.linkedElementId,
        linkedElementName: comp.linkedElementName,
        linkedDiagramName,
        customColor: comp.customColor,
        isSelected: ctx.selectedNodeId === comp.id,
        onOpenInCanvas:
          canNavigate && ctx.navigateToDiagram
            ? () => ctx.navigateToDiagram!(comp.referenceDiagramId, comp.linkedElementId)
            : undefined,
      };
    },

    buildStyle: (comp, ctx) => {
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? EXTERNAL_ELEMENT_W,
        height: layout?.height ?? EXTERNAL_ELEMENT_H,
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: ExternalLink },
    accent: { kind: "neutral" },
    searchKeys: ["external", "externo", "reference", "referencia", "link"],
  },

  inspector: {
    panel: ExternalElementInspector,
  },

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isExternalElementComponent(comp)) {
          throw new Error(`[elements] external-element export received a ${comp.type} component.`);
        }
        // A passthrough rather than a kind of its own: draw.io has no shape for
        // "a stand-in for something in another diagram", and what matters is
        // the name plus which diagram it points at. The box says both, and
        // structuraType keeps the type recoverable.
        return {
          ...base,
          kind: "passthrough",
          name: comp.name,
          description: comp.linkedDiagramName ?? comp.linkedElementName,
          originType: comp.type,
          originLabel: i18n.t("quickInsert.typeExternalElement"),
        };
      },
    },
  },
};
