import PanelNode from "../nodes/PanelNode";
import type { NodeTypeDescriptor } from "./types";
import { PANEL_DEFAULT_W, PANEL_DEFAULT_H } from "./constants";

export const panelDescriptor: NodeTypeDescriptor = {
  rfType: "panel",
  component: PanelNode,
  matches: (type) => type === "panel",
  zIndex: -1,
  connectable: false,
  canHaveParent: false,
  canBeParent: true,

  buildData: (comp, ctx) => ({
    elementId: comp.id,
    name: comp.name,
    description: comp.description || undefined,
    panelColor: comp.panelColor,
    panelOpacity: comp.panelOpacity,
    isSelected: ctx.selectedNodeId === comp.id,
    isDragTarget: ctx.dragTargetPanelId === comp.id,
    collapsed: comp.collapsed ?? false,
    childCount: Object.values(ctx.diagram.snapshot.components).filter(
      (c) => c.parentId === comp.id,
    ).length,
    onToggleCollapse: () => ctx.onPanelCollapseToggle?.(comp.id),
  }),

  buildStyle: (comp) =>
    comp.collapsed
      ? { width: 200, height: 60 }
      : {
          width: comp.width ?? PANEL_DEFAULT_W,
          height: comp.height ?? PANEL_DEFAULT_H,
        },
};