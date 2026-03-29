import JsonViewerNode from "../JsonViewerNode";
import { isJsonViewerComponent, isJsonViewerType } from "@/features/diagram";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";

const JSON_VIEWER_DEFAULT_W = 240;
const JSON_VIEWER_DEFAULT_H = 88;

export const jsonViewerDescriptor: NodeTypeDescriptor = {
  rfType: "json-viewer",
  component: JsonViewerNode,
  matches: isJsonViewerType,
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,
  defaultSize: { width: JSON_VIEWER_DEFAULT_W, height: JSON_VIEWER_DEFAULT_H },
  dragHandle: ".drag-handle",

  buildData: (comp, ctx) => {
    if (!isJsonViewerComponent(comp)) return {};

    const layout = ctx.resolvedNodeLayouts[comp.id];

    return {
      elementId: comp.id,
      name: comp.name,
      jsonContent: comp.jsonContent,
      schemaRef: comp.schemaRef,
      isSelected: ctx.selectedNodeId === comp.id,
      layoutWidth: layout?.width ?? JSON_VIEWER_DEFAULT_W,
      layoutHeight: layout?.height ?? JSON_VIEWER_DEFAULT_H,
      onStartEdit: ctx.onJsonViewerStartEdit
        ? () => ctx.onJsonViewerStartEdit!(comp.id)
        : undefined,
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
};
