import { Square } from "lucide-react";
import PanelNode from "@/features/canvas/nodes/PanelNode";
import SwimlaneNode from "@/features/canvas/nodes/SwimlaneNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import { sceneBadgePropsForNode } from "@/features/canvas/nodes/node-types/compare-node-badges";
import {
  MAX_HANDLES,
  PANEL_DEFAULT_H,
  PANEL_DEFAULT_W,
  SWIMLANE_DEFAULT_H,
  SWIMLANE_DEFAULT_W,
} from "@/features/canvas/canvas.constants";
import { COMPONENT_TYPE_PANEL } from "@/features/diagram/model/component-type-constants";
import { isPanelComponent } from "@/features/diagram/model/component.guards";
import { PanelKind } from "@/features/diagram/enums";
import { DEFAULT_PANEL_OPACITY } from "@/features/canvas/constants/panel.constants";
import { getPanelKindDef, PANEL_KINDS } from "@/lib/catalogs/panels";
import i18n from "@/infrastructure/i18n";
import type { Component } from "@/features/diagram/model/component.types";
import type { ElementCanvasSlice, ElementDescriptor } from "../element.types";

const PANEL_COLLAPSED_W = 200;
const PANEL_COLLAPSED_H = 60;

/** A panel that is a lane rather than a box. */
function isSwimlane(comp: Component): boolean {
  return isPanelComponent(comp) && comp.panelKind === PanelKind.Swimlane;
}

const swimlaneCanvas: ElementCanvasSlice = {
  rfType: PanelKind.Swimlane,
  component: SwimlaneNode,
  handles: SPREAD_HANDLES,
  role: "container",
  zIndex: -1,
  connectable: false,
  canHaveParent: true,
  canBeParent: true,
  canBeConnectionSource: true,
  derivesSize: false,

  buildData: (comp, ctx) => {
    if (!isPanelComponent(comp) || comp.panelKind !== PanelKind.Swimlane) return {};
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
    if (!isPanelComponent(comp) || comp.panelKind !== PanelKind.Swimlane) return undefined;
    const layout = ctx.resolvedNodeLayouts[comp.id];
    return {
      width: layout?.width ?? SWIMLANE_DEFAULT_W,
      height: layout?.height ?? SWIMLANE_DEFAULT_H,
    };
  },
};

export const panelElement: ElementDescriptor = {
  id: COMPONENT_TYPE_PANEL,
  family: "structural",
  labelKey: "canvasToolbar.panel",
  descriptionKey: "elements.panel.description",

  model: {
    createComponent: (base, options) => {
      const kind = options.panelKind ?? PanelKind.Default;
      const def = getPanelKindDef(kind);
      return {
        ...base,
        type: COMPONENT_TYPE_PANEL,
        panelKind: kind,
        panelColor: def.defaultColor,
        ...(kind === PanelKind.Swimlane
          ? {
              swimlane: {
                orientation: "horizontal" as const,
                laneColor: "#6366f1",
                laneLabel: i18n.t("swimlane.defaultLaneLabel"),
              },
            }
          : {}),
      };
    },

    // A lane is long and shallow where a box is not, and both are `panel`.
    defaultSize: (options) =>
      options.panelKind === PanelKind.Swimlane
        ? { width: SWIMLANE_DEFAULT_W, height: SWIMLANE_DEFAULT_H }
        : { width: PANEL_DEFAULT_W, height: PANEL_DEFAULT_H },

    // A container is created behind whatever is dropped into it.
    defaultZIndex: -1,
    patchableKeys: [
      "panelKind",
      "panelColor",
      "panelOpacity",
      "borderStyle",
      "collapsed",
      "collapsedWidth",
      "collapsedHeight",
      "swimlane",
    ],
  },

  canvas: {
    rfType: COMPONENT_TYPE_PANEL,
    component: PanelNode,
    handles: SPREAD_HANDLES,
    role: "container",
    zIndex: -1,
    connectable: false,
    canHaveParent: true,
    canBeParent: true,
    canBeConnectionSource: true,
    // Collapsing swaps in a fixed small box; the size is never measured.
    derivesSize: false,

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
        ? { width: PANEL_COLLAPSED_W, height: PANEL_COLLAPSED_H }
        : {
            width: layout?.width ?? PANEL_DEFAULT_W,
            height: layout?.height ?? PANEL_DEFAULT_H,
          };
    },
  },

  variants: [{ matches: isSwimlane, canvas: swimlaneCanvas }],

  palette: {
    categoryId: "canvas",
    icon: { kind: "lucide", icon: Square },
    accent: { kind: "neutral" },
    searchKeys: ["panel", "painel", "group", "grupo"],
    /**
     * One entry per panel kind, which is how the palette has always offered
     * them: a VPC, an EKS cluster, a swimlane and the rest all create a
     * `panel` and differ only by the kind they carry.
     */
    variants: PANEL_KINDS.map((kind) => ({
      id: kind.id,
      labelKey: kind.labelKey,
      icon: { kind: "lucide" as const, icon: kind.icon },
      createOptions: { panelKind: kind.id },
      awsIconName: kind.awsIconName,
      searchKeys:
        kind.id === PanelKind.Swimlane
          ? ["swimlane", "lane", "strip", "actor", "pool", "domain", "team", "faixa", "raia"]
          : ["panel", "painel", "group", "grupo"],
    })),
  },

  // Panels are edited through the generic ComponentPanel and its style section.
  inspector: {},

  export: {
    drawio: {
      toExportNode: (comp, base) => {
        if (!isPanelComponent(comp)) {
          throw new Error(`[elements] panel export received a ${comp.type} component.`);
        }
        const kindDef = getPanelKindDef(comp.panelKind);

        // Swimlanes get their own IR kind so the drawio cell builder emits the
        // `swimlane;horizontal=N` shape instead of a generic panel rectangle.
        if (comp.panelKind === PanelKind.Swimlane) {
          const sl = comp.swimlane;
          return {
            ...base,
            kind: "swimlane",
            name: comp.name,
            laneColor: sl?.laneColor ?? comp.panelColor ?? kindDef.defaultColor ?? "#6366f1",
            laneLabel: sl?.laneLabel ?? comp.name,
            orientation: sl?.orientation ?? "horizontal",
            opacity: sl?.opacity ?? comp.panelOpacity ?? DEFAULT_PANEL_OPACITY,
          };
        }

        return {
          ...base,
          kind: "panel",
          name: comp.name,
          panelColor: comp.panelColor,
          panelKindDefaultColor: kindDef.defaultColor,
          panelOpacity: comp.panelOpacity ?? DEFAULT_PANEL_OPACITY,
          borderStyle: comp.borderStyle ?? "solid",
        };
      },
    },
  },
};
