import PanelNode from "../PanelNode";
import type { NodeTypeDescriptor } from "./types";
import { sceneBadgePropsForNode } from "./compare-node-badges";
import { isPanelComponent, isPanelType } from "@/features/diagram";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import { MAX_HANDLES, PANEL_DEFAULT_W, PANEL_DEFAULT_H } from "../../canvas.constants";

export const panelDescriptor: NodeTypeDescriptor = {
  rfType: "panel",
  component: PanelNode,
  matches: isPanelType,
  zIndex: -1,
  connectable: false,
  canHaveParent: true,
  canBeParent: true,
  /**
   * Phase 4 — decision #2. The panel moves by its header or by its border
   * ring, never by its interior. Without this, the panel body competes with
   * connector handles for the gesture, which (a) caused the freeze reported
   * by the product owner when dragging by the body, and (b) defeats the
   * body = marquee decision.
   *
   * The value is a selector LIST, and React Flow evaluates it with
   * `target.closest(dragHandle)`, so both parts match. `.panel-border` is the
   * four 8 px ring strips in `PanelNode.tsx`; `.panel-header` is the title
   * band. Measured before adding `.panel-border`: a drag started on the ring
   * left the panel at its original `translate(...)` — the ring selected the
   * panel but could not move it, which contradicted the decision as written.
   */
  dragHandle: ".panel-header, .panel-border",

  buildData: (comp, ctx) => {
    if (!isPanelComponent(comp)) return {};
    const def = getPanelKindDef(comp.panelKind);
    // Same source and same clamp as the C4 descriptor, and it has to stay that
    // way: `buildEdgeHandleAssignments` picks the slot from these very counts,
    // so a panel that renders fewer handles than the assignment reaches for
    // loses the edge to React Flow error #008.
    const counts = ctx.connectionCounts[comp.id] ?? { incoming: 0, outgoing: 0 };
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
      childCount: ctx.childrenIndex.get(comp.id)?.size ?? 0,
      incomingCount: Math.min(MAX_HANDLES, Math.max(1, counts.incoming)),
      outgoingCount: Math.min(MAX_HANDLES, Math.max(1, counts.outgoing)),
      onToggleCollapse: () => ctx.onPanelCollapseToggle?.(comp.id),
      ...sceneBadgePropsForNode(ctx, comp.id),
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
