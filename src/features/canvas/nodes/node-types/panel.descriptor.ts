import PanelNode from "../PanelNode";
import type { NodeTypeDescriptor } from "./types";
import { isPanelComponent, isPanelType } from "@/features/diagram";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import { PANEL_DEFAULT_W, PANEL_DEFAULT_H } from "../../constants";

export const panelDescriptor: NodeTypeDescriptor = {
  rfType: "panel",
  component: PanelNode,
  matches: isPanelType,
  zIndex: -1,
  connectable: false,
  canHaveParent: true,
  canBeParent: true,

  buildData: (comp, ctx) => {
    if (!isPanelComponent(comp)) return {};
    const def = getPanelKindDef(comp.panelKind);
    return {
      elementId: comp.id,
      name: comp.name,
      description: comp.description || undefined,
      panelKind: comp.panelKind,
      awsIconName: def.awsIconName,
      panelColor: comp.panelColor,
      panelOpacity: comp.panelOpacity,
      borderStyle: comp.borderStyle ?? "solid",
      isSelected: ctx.selectedNodeId === comp.id,
      isDragTarget: ctx.dragTargetPanelId === comp.id,
      isUnparentCandidate: ctx.unparentCandidatePanelId === comp.id,
      collapsed: comp.collapsed ?? false,
      childCount: Object.values(ctx.resolvedComponents).filter(
        (c) => c.parentId === comp.id,
      ).length,
      onToggleCollapse: () => ctx.onPanelCollapseToggle?.(comp.id),
      ...(ctx.sceneBadgeByComponentId[comp.id]
        ? { sceneBadge: ctx.sceneBadgeByComponentId[comp.id] }
        : {}),
    };
  },

  buildStyle: (comp, ctx) => {
    if (!isPanelComponent(comp)) return undefined;
    const layout = ctx.resolvedNodeLayouts[comp.id];
    return comp.collapsed
      ? { width: 200, height: 60 }
      : {
          width: layout?.width ?? PANEL_DEFAULT_W,
          height: layout?.height ?? PANEL_DEFAULT_H,
        };
  },
};
