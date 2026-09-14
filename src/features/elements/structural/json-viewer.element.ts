import { Braces } from "lucide-react";
import { createElement } from "react";
import JsonViewerNode from "@/features/canvas/nodes/JsonViewerNode";
import JsonViewerPanel from "@/features/canvas/panels/ElementPanel/JsonViewerPanel";
import { SINGLE_INCOMING_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import { COMPONENT_TYPE_JSON_VIEWER } from "@/features/diagram/model/component-type-constants";
import { isJsonViewerComponent } from "@/features/diagram/model/component.guards";
import type { ElementDescriptor, ElementInspectorProps } from "../element.types";

const JSON_VIEWER_DEFAULT_W = 240;
const JSON_VIEWER_DEFAULT_H = 88;

/**
 * The inspector adapter.
 *
 * `ElementInspectorProps.component` is the wide union, and `JsonViewerPanel`
 * wants the narrow variant. Narrowing here with the guard is what keeps the
 * registry contract cast-free; a component of another type reaching this panel
 * is a registry bug, and rendering nothing is the honest response to it.
 */
function JsonViewerInspector(props: ElementInspectorProps) {
  const { component, ...rest } = props;
  if (!isJsonViewerComponent(component)) return null;
  return createElement(JsonViewerPanel, { component, ...rest });
}

export const jsonViewerElement: ElementDescriptor = {
  id: COMPONENT_TYPE_JSON_VIEWER,
  family: "structural",
  labelKey: "nodeTypes.json-viewer",
  descriptionKey: "elements.json-viewer.description",

  model: {
    createComponent: (base) => ({ ...base, type: COMPONENT_TYPE_JSON_VIEWER, jsonContent: "{}" }),
    defaultSize: { width: JSON_VIEWER_DEFAULT_W, height: JSON_VIEWER_DEFAULT_H },
    patchableKeys: ["jsonContent", "schemaRef"],
  },

  canvas: {
    rfType: "json-viewer",
    component: JsonViewerNode,
    handles: SINGLE_INCOMING_HANDLES,
    role: "custom-shape",
    zIndex: 1,
    connectable: true,
    canHaveParent: true,
    canBeParent: false,
    // A JSON payload is a thing the diagram points at; nothing leaves it.
    // `SINGLE_INCOMING_HANDLES` says the same on the canvas side.
    canBeConnectionSource: false,
    // Size comes from the stored layout, never from the JSON it holds.
    derivesSize: false,
    dragHandle: ".drag-handle",

    buildData: (comp, ctx) => {
      if (!isJsonViewerComponent(comp)) return {};

      const layout = ctx.resolvedNodeLayouts[comp.id];

      return {
        elementId: comp.id,
        name: comp.name,
        jsonContent: comp.jsonContent,
        schemaRef: comp.schemaRef,
        customColor: (comp as { customColor?: string }).customColor,
        isSelected: ctx.selectedNodeId === comp.id,
        layoutWidth: layout?.width ?? JSON_VIEWER_DEFAULT_W,
        layoutHeight: layout?.height ?? JSON_VIEWER_DEFAULT_H,
        onInlineEditingChange: ctx.setJsonViewerInlineEditingId
          ? (editing: boolean) => ctx.setJsonViewerInlineEditingId!(editing ? comp.id : null)
          : undefined,
        ...sceneBadgePropsForNode(ctx, comp.id),
      };
    },

    buildStyle: (comp, ctx) => {
      if (!isJsonViewerComponent(comp)) return undefined;
      const layout = ctx.resolvedNodeLayouts[comp.id];
      return {
        width: layout?.width ?? JSON_VIEWER_DEFAULT_W,
        height: layout?.height ?? JSON_VIEWER_DEFAULT_H,
      };
    },
  },

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: Braces },
    accent: { kind: "neutral" },
    searchKeys: ["json", "payload", "contract", "contrato", "schema", "event", "evento", "api"],
  },

  inspector: {
    panel: JsonViewerInspector,
  },

  export: {
    drawio: {
      kind: "jsonViewer",
      toExportNode: (comp, base) => {
        if (!isJsonViewerComponent(comp)) {
          throw new Error(`[elements] json-viewer export received a ${comp.type} component.`);
        }
        return {
          ...base,
          kind: "jsonViewer",
          name: comp.name,
          jsonContent: comp.jsonContent,
          schemaRef: comp.schemaRef,
        };
      },
    },
  },
};
