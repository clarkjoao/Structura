import SwimlaneNode from "../SwimlaneNode";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";
import type { ComponentType } from "@/features/diagram";
import { isPanelComponent } from "@/features/diagram";
import { SWIMLANE_DEFAULT_H, SWIMLANE_DEFAULT_W } from "../../canvas.constants";

export const swimlaneDescriptor: NodeTypeDescriptor = {
  rfType: "swimlane",
  component: SwimlaneNode,

  matches: (_type: ComponentType) => false,
  zIndex: -1,
  connectable: false,
  canHaveParent: true,
  canBeParent: true,

  buildData: (comp, ctx) => {
    if (!isPanelComponent(comp) || comp.panelKind !== "swimlane") return {};
    const sl = comp.swimlane;
    const orientation = sl?.orientation ?? "horizontal";
    const laneColor = sl?.laneColor ?? comp.panelColor ?? "#6366f1";
    const laneLabel = sl?.laneLabel ?? "";
    // Swimlanes honour both a dedicated swimlane.opacity field and the
    // shared panelOpacity fallback so the editor only has to set one place.
    const opacity = sl?.opacity ?? comp.panelOpacity;
    return {
      elementId: comp.id,
      name: comp.name,
      orientation,
      laneColor,
      laneLabel,
      opacity,
      isSelected: ctx.selectedNodeId === comp.id,
      isDragTarget: ctx.dragTargetPanelId === comp.id,
      isUnparentCandidate: ctx.unparentCandidatePanelId === comp.id,
      ...sceneBadgePropsForNode(ctx, comp.id),
    };
  },

  buildStyle: (comp, ctx) => {
    if (!isPanelComponent(comp) || comp.panelKind !== "swimlane") return undefined;
    const layout = ctx.resolvedNodeLayouts[comp.id];
    return {
      width: layout?.width ?? SWIMLANE_DEFAULT_W,
      height: layout?.height ?? SWIMLANE_DEFAULT_H,
    };
  },
};
