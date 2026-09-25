import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { accentTextColor, tintOver } from "@/features/diagram";
import { resolveThemeColor } from "./ProcessNode/useOnAccentColor";
import { useCanvasBackdrop } from "./use-canvas-backdrop";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { withAlpha } from "./swimlane-color";
import { useTranslation } from "react-i18next";
import { CompareVersionBadges, VersionElementBadge } from "./VersionElementBadge";
import { useCollabHighlight } from "@/features/collaboration/hooks/useCollabHighlight";

export type SwimlaneNodeData = {
  elementId: string;
  name: string;
  orientation: "horizontal" | "vertical";
  laneColor: string;
  laneLabel: string;
  /** Background tint 0–100. Falls back to a low-opacity tint when unset. */
  opacity?: number;
  /** The panel's outline; a dashed lane is the blueprint's physical evidence. */
  borderStyle?: "solid" | "dashed" | "dotted";
  isSelected: boolean;
  isHighlighted?: boolean;
  isDragTarget?: boolean;
  isUnparentCandidate?: boolean;
  versionBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};

const DEFAULT_SWIMLANE_OPACITY = 9;

/** The lane header: a 44px band down the left (or across the top of a vertical lane). */
const SWIMLANE_HEADER = 44;
/** How strongly the header is washed with the lane's accent, over the lane's own tint. */
const HEADER_TINT_PCT = 12;

const UNPARENT_BORDER = "hsl(25 95% 53%)";

const SwimlaneNode = memo((props: NodeProps<Node<SwimlaneNodeData>>) => {
  const { data, selected, dragging } = props;
  const d = data as SwimlaneNodeData;
  const isResizing =
    "resizing" in props ? Boolean((props as NodeProps & { resizing?: boolean }).resizing) : false;
  const { t } = useTranslation();
  const { highlightedNodeIds } = useHandleHighlight();
  const isHorizontal = d.orientation !== "vertical";
  const backdrop = useCanvasBackdrop();
  // A lane accent may be a theme token (the flow presets): resolved against the
  // active theme — re-rendered with the backdrop when it flips — because a
  // translucent fill and a contrast ratio both need channels.
  const laneColor = resolveThemeColor(d.laneColor || "#6366f1");
  const opacityPct = Math.max(0, Math.min(100, d.opacity ?? DEFAULT_SWIMLANE_OPACITY));
  const fill = withAlpha(laneColor, opacityPct);
  const labelText = d.laneLabel?.trim() || d.name?.trim() || t("swimlane.defaultLaneLabel");
  // The header is the lane tint plus the header wash, over the canvas; its text
  // is the accent itself, darkened (or lightened) just enough for 4.5:1.
  const headerBg = tintOver(laneColor, opacityPct + HEADER_TINT_PCT, backdrop);
  const labelColor = accentTextColor(laneColor, headerBg);

  const isSelected = selected || d.isSelected;
  const isHighlighted = (d.isHighlighted ?? false) || highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;
  const isDragTarget = d.isDragTarget;
  const isUnparentCandidate = d.isUnparentCandidate ?? false;
  const collabHighlight = useCollabHighlight(d.elementId);
  const motionClass = dragging || isResizing ? "" : "transition-all duration-200";

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2.5 !h-2.5 !border-background !rounded-sm"
        handleStyle={{ backgroundColor: laneColor }}
      />
      <div
        className={`relative w-full h-full rounded-lg border ${motionClass} ${
          isUnparentCandidate ? "" : "border-border/40"
        } ${isActive ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110" : "opacity-95"}`}
        style={{
          background: fill,
          ...(d.borderStyle === "dashed" || d.borderStyle === "dotted"
            ? { border: `1.5px ${d.borderStyle} ${withAlpha(laneColor, 60)}` }
            : {}),
          ...(isUnparentCandidate ? { borderColor: UNPARENT_BORDER } : {}),
        }}
      >
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}
        {d.compareBadges && <CompareVersionBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
        {!d.compareBadges && d.versionBadge && (
          <VersionElementBadge name={d.versionBadge.name} color={d.versionBadge.color} />
        )}
        <div
          className={`absolute z-[1] pointer-events-none flex items-center justify-center overflow-hidden ${
            isHorizontal
              ? "left-0 top-0 bottom-0 rounded-l-lg"
              : "top-0 left-0 right-0 rounded-t-lg"
          }`}
          style={{
            [isHorizontal ? "width" : "height"]: SWIMLANE_HEADER,
            background: withAlpha(laneColor, HEADER_TINT_PCT),
            [isHorizontal ? "borderRight" : "borderBottom"]:
              `1px solid ${withAlpha(laneColor, 30)}`,
            ...(isUnparentCandidate
              ? { [isHorizontal ? "borderLeft" : "borderTop"]: `3px solid ${UNPARENT_BORDER}` }
              : {}),
          }}
          data-testid="swimlane-header"
        >
          <span
            className="max-h-full max-w-full select-none truncate whitespace-nowrap px-1 text-xs font-semibold uppercase tracking-[0.04em]"
            style={{
              color: labelColor,
              ...(isHorizontal
                ? { writingMode: "vertical-rl" as const, transform: "rotate(180deg)" }
                : {}),
            }}
          >
            {labelText}
          </span>
        </div>
        {isDragTarget && (
          <div
            className="absolute inset-0 rounded-lg animate-pulse-glow pointer-events-none z-0"
            style={{ boxShadow: `0 0 20px 4px ${withAlpha(laneColor, 50)}` }}
          />
        )}
        <div
          className="p-3 h-full min-h-[48px]"
          style={
            isHorizontal
              ? { paddingLeft: SWIMLANE_HEADER + 12 }
              : { paddingTop: SWIMLANE_HEADER + 12 }
          }
        />
      </div>
    </>
  );
});

SwimlaneNode.displayName = "SwimlaneNode";

export default SwimlaneNode;
