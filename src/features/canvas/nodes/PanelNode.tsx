import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useComponentIcon } from "@/features/diagram";
import { CustomIconRenderer } from "@/features/canvas/components/icons/CustomIconRenderer";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import AwsIcon from "./AwsIcon";
import { useTranslation } from "react-i18next";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration";
import { CollabPeerPresence } from "@/features/canvas/components/CollabPeerPresence";
import { usePeerOnNode } from "@/features/canvas/hooks/usePeerOnNode";
import { DEFAULT_PANEL_OPACITY, PANEL_BORDER_HIT_PX } from "../constants/panel.constants";
import { buildPanelHeaderLabel, buildPanelSubLabel } from "./panelLabel";

export type PanelNodeData = {
  elementId: string;
  name: string;
  description?: string;
  panelKind?: string;

  awsIconName?: string;
  panelColor?: string;
  panelOpacity?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  isSelected: boolean;
  isHighlighted?: boolean;
  isDragTarget?: boolean;

  isUnparentCandidate?: boolean;
  collapsed?: boolean;
  childCount?: number;
  onToggleCollapse?: () => void;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const hslMatch = color.match(/hsl\(([^)]+)\)/);
  if (hslMatch) {
    return `hsl(${hslMatch[1]} / ${alpha})`;
  }
  return color;
}

const UNPARENT_BORDER = "hsl(25 95% 53%)";

const PanelNode = memo((props: NodeProps<Node<PanelNodeData>>) => {
  const { data, selected, dragging } = props;
  const d = data as PanelNodeData;
  const isResizing =
    "resizing" in props ? Boolean((props as NodeProps & { resizing?: boolean }).resizing) : false;
  const { t } = useTranslation();
  const customDiagramIcon = useComponentIcon(d.elementId);
  const { highlightedNodeIds } = useHandleHighlight();
  const kindDef = getPanelKindDef(
    d.panelKind as import("@/features/diagram").PanelKind | undefined,
  );
  const color = d.panelColor || kindDef.defaultColor;
  const useAwsIcon = d.awsIconName ?? kindDef.awsIconName;
  const Icon = kindDef.icon;
  const opacity = d.panelOpacity ?? DEFAULT_PANEL_OPACITY;
  const isSelected = selected || d.isSelected;
  const isHighlighted = (d.isHighlighted ?? false) || highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;
  const isDragTarget = d.isDragTarget;
  const isUnparentCandidate = d.isUnparentCandidate ?? false;
  const collapsed = d.collapsed ?? false;
  const childCount = d.childCount ?? 0;
  const onToggle = d.onToggleCollapse;

  const bgAlpha = isDragTarget ? Math.min(opacity + 15, 40) / 100 : opacity / 100;
  const isTransparent = opacity === 0;
  const collabHighlight = useCollabHighlight(d.elementId);
  const activePeer = usePeerOnNode(d.elementId);
  const backgroundColor = isTransparent
    ? "transparent"
    : colorWithAlpha(color, isDragTarget ? bgAlpha : collapsed ? Math.max(bgAlpha, 0.12) : bgAlpha);
  const borderColor = isUnparentCandidate
    ? UNPARENT_BORDER
    : isActive || isDragTarget
      ? color
      : colorWithAlpha(color, 0.4);
  const borderStyle = (d.borderStyle ?? "solid") as "solid" | "dashed" | "dotted";

  /** CSS transitions fight RF drag/resize — disable while moving or resizing. */
  const motionClass = dragging || isResizing ? "" : "transition-all duration-200";

  const selectedRing = "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110";
  const unselectedClass = "opacity-90";

  if (collapsed) {
    return (
      <div
        className={`relative w-full h-full rounded-lg panel-header flex items-center gap-2 px-3 ${motionClass} ${isActive ? selectedRing : unselectedClass}`}
        style={{
          backgroundColor,
          border: `2px ${borderStyle} ${borderColor}`,
        }}
      >
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}
        {activePeer && <CollabPeerPresence activePeer={activePeer} roundedClassName="rounded-lg" />}
        {d.compareBadges && <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
        {!d.compareBadges && d.sceneBadge && (
          <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
        )}
        {customDiagramIcon ? (
          <div className="shrink-0 opacity-80" style={{ color }}>
            <CustomIconRenderer icon={customDiagramIcon} size={24} />
          </div>
        ) : useAwsIcon ? (
          <div className="shrink-0 opacity-80" style={{ color }}>
            <AwsIcon iconName={useAwsIcon} size={18} />
          </div>
        ) : (
          <Icon className="h-4 w-4 shrink-0 opacity-80" style={{ color }} />
        )}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground truncate block">
            {d.name || t("panelNode.defaultName")}
          </span>
          <span className="text-[8px] text-muted-foreground text-nowrap truncate">
            {buildPanelSubLabel(
              d.panelKind,
              kindDef.label,
              d.name || t("panelNode.defaultName"),
              t("panelNode.childElements", { count: childCount }),
            )}
          </span>
        </div>
        {onToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={t("panelNode.expandAria")}
            aria-expanded={false}
            className="shrink-0 p-1 rounded hover:bg-black/10 text-muted-foreground hover:text-foreground"
            title={t("panelNode.expandTitle")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2.5 !h-2.5 !border-background !rounded-sm"
        handleStyle={{ backgroundColor: color }}
      />
      <div
        className={`w-full h-full rounded-xl ${motionClass} relative flex flex-col ${!isTransparent ? "backdrop-blur-sm" : ""} ${isActive ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110" : "opacity-90"}`}
        style={{
          backgroundColor,
          border: `2px ${borderStyle} ${borderColor}`,
        }}
      >
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none rounded-xl z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}
        {activePeer && <CollabPeerPresence activePeer={activePeer} roundedClassName="rounded-xl" />}
        {d.compareBadges && <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
        {!d.compareBadges && d.sceneBadge && (
          <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
        )}
        {isDragTarget && (
          <div
            className="absolute inset-0 rounded-xl animate-pulse-glow pointer-events-none"
            style={{ boxShadow: `0 0 20px 4px ${colorWithAlpha(color, 0.5)}` }}
          />
        )}
        {/*
         * Phase 4 — decisions #1 + #2. Three named hit regions, and the
         * geometry below is the whole point: an earlier revision described
         * this layout in prose while the DOM did something else, and the
         * Cypress case that "proved" it clicked with `force: true`, i.e. an
         * element no cursor could reach.
         *
         *  - `.panel-border` — four absolutely positioned strips forming a
         *    ring `PANEL_BORDER_HIT_PX` (8 px) wide, measured inward from the
         *    container's padding box. Clicking or dragging here selects and
         *    moves the panel. It is four elements and not one `inset-0` div
         *    with an 8 px transparent border because a div's hit area is its
         *    whole border box: `inset-0` made the "ring" cover the entire
         *    panel, which is exactly how the interior ended up selecting.
         *  - `.panel-header` — the drag handle (decision #2, enforced by
         *    `dragHandle` in `node-types/panel.descriptor.ts`) and a select
         *    target on click.
         *  - `.panel-body` — the empty interior. `flex-1` on a `flex-col`
         *    container is what gives it real height; before this it laid out
         *    at 397×0 and never received a single real pointer event.
         *
         * Stacking: ring `z-[2]` over header `z-[1]` over body `z-0`, so the
         * 8 px band wins over the header at the top corners. The ring's boxes
         * start at the padding box, i.e. 2 px in from the node's outer edge —
         * that outer 2 px stays free for `NodeResizer`'s handles, which is
         * where they were reachable before this change too.
         */}
        <div
          className="panel-border absolute z-[2] left-0 right-0 top-0"
          data-border-side="top"
          style={{ height: PANEL_BORDER_HIT_PX }}
        />
        <div
          className="panel-border absolute z-[2] left-0 right-0 bottom-0"
          data-border-side="bottom"
          style={{ height: PANEL_BORDER_HIT_PX }}
        />
        <div
          className="panel-border absolute z-[2] top-0 bottom-0 left-0"
          data-border-side="left"
          style={{ width: PANEL_BORDER_HIT_PX }}
        />
        <div
          className="panel-border absolute z-[2] top-0 bottom-0 right-0"
          data-border-side="right"
          style={{ width: PANEL_BORDER_HIT_PX }}
        />
        <div className="panel-header relative z-[1] shrink-0 flex items-start gap-2 px-3 py-2.5">
          {customDiagramIcon ? (
            <div className="shrink-0 mt-0.5" style={{ color }}>
              <CustomIconRenderer icon={customDiagramIcon} size={24} />
            </div>
          ) : useAwsIcon ? (
            <div className="shrink-0 mt-0.5" style={{ color }}>
              <AwsIcon iconName={useAwsIcon} size={18} />
            </div>
          ) : (
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color }} />
          )}
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground truncate block">
              {buildPanelHeaderLabel(d.panelKind, kindDef.label, d.name)}
            </span>
            {d.description && (
              <span className="text-xs text-muted-foreground line-clamp-1 block">
                {d.description}
              </span>
            )}
          </div>
          {onToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label={t("panelNode.collapseAria")}
              aria-expanded={true}
              className="shrink-0 p-1 rounded hover:bg-black/10 text-muted-foreground hover:text-foreground"
              title={t("panelNode.collapseTitle")}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
        {/*
         * The body is a sibling of the header inside the same outer container.
         * Child nodes are separate `.react-flow__node` elements rendered by
         * React Flow (because they have parentId); they sit ABOVE the body in
         * DOM order via React Flow's transform layer.
         *
         * Decision #1 in full: the interior of a panel behaves as CANVAS
         * BACKGROUND. A click clears the selection, a drag draws a marquee,
         * and neither selects or moves the panel. The two handlers below are
         * what makes that true, and each one is load-bearing for a different
         * half — both were measured in real Chrome, not read off the code:
         *
         *  - `onPointerDown` forwards the LEFT-button press to
         *    `.react-flow__pane`. React Flow only arms `selectionOnDrag` when
         *    the press lands on the pane element itself:
         *
         *        const eventTargetIsContainer = event.target === container.current;
         *        const isSelectionActive =
         *          (selectionOnDrag && eventTargetIsContainer) || selectionKeyPressed;
         *        if (isNoKeyEvent || !isSelecting || !isSelectionActive || ...) return;
         *
         *    (`@xyflow/react/dist/esm/index.mjs`, `Pane.onPointerDownCapture`.)
         *    A press on `.panel-body` fails that guard, so before this the
         *    interior drew no marquee at all — measured as 0 marquee frames
         *    against 12 for the identical drag started one pixel outside the
         *    panel. Re-dispatching the press with the pane as target satisfies
         *    the guard; React Flow then calls `setPointerCapture` on the pane,
         *    so every later move and the release go to the pane natively and
         *    the rest of the gesture needs no help from us.
         *
         *    Right button is deliberately NOT forwarded: the panel's own
         *    context menu (decision #7, rows 0.4-0.6 of the manual script)
         *    comes from the funnel resolving this element, and forwarding
         *    would turn it into the pane's quick-insert.
         *
         *  - `onClick` stops the click from reaching React Flow's node click
         *    handler. This one is NOT dead code, and the measurement that says
         *    so is worth keeping: with the geometry fixed and this handler
         *    removed, a real click in the interior with nothing selected
         *    SELECTED the panel. So propagation up to the node element is the
         *    real mechanism behind "the body does not select" — the corrected
         *    geometry alone does not deliver decision #1. The `stopPropagation`
         *    the previous revision carried as dead weight (the body was 397x0
         *    and never received an event) is now the thing doing the work.
         */}
        <div
          className="panel-body relative z-0 flex-1 min-h-0"
          style={{ pointerEvents: "auto" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const pane = e.currentTarget
              .closest(".react-flow")
              ?.querySelector<HTMLElement>(".react-flow__pane");
            if (!pane) return;
            const native = e.nativeEvent;
            pane.dispatchEvent(
              new PointerEvent("pointerdown", {
                pointerId: native.pointerId,
                pointerType: native.pointerType,
                isPrimary: native.isPrimary,
                clientX: native.clientX,
                clientY: native.clientY,
                screenX: native.screenX,
                screenY: native.screenY,
                button: native.button,
                buttons: native.buttons,
                ctrlKey: native.ctrlKey,
                shiftKey: native.shiftKey,
                altKey: native.altKey,
                metaKey: native.metaKey,
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,
              }),
            );
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
        />
      </div>
    </>
  );
});

PanelNode.displayName = "PanelNode";

export default PanelNode;
