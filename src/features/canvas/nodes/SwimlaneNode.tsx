import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { useTranslation } from "react-i18next";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration";

export type SwimlaneNodeData = {
  elementId: string;
  name: string;
  orientation: "horizontal" | "vertical";
  laneColor: string;
  laneLabel: string;
  /** Background tint 0–100. Falls back to a low-opacity tint when unset. */
  opacity?: number;
  isSelected: boolean;
  isHighlighted?: boolean;
  isDragTarget?: boolean;
  isUnparentCandidate?: boolean;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};

const DEFAULT_SWIMLANE_OPACITY = 9;

export function withAlpha(color: string, opacityPct: number): string {
  const rgb = colorToRgb(color);
  if (!rgb) return color;
  const alpha = Math.max(0, Math.min(1, opacityPct / 100));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Pick a label colour that stays legible on the rendered background.
 *
 * The label sits over the lane's translucent fill. We blend the lane colour
 * toward white using the same `1 - opacity` ratio the fill uses, then compute
 * the perceived luminance of the resulting on-screen colour. Above 0.6 we use
 * a near-white label (the lane is fully saturated, white text wins); below
 * 0.3 we use the lane colour itself (faint tint, no contrast gain from white);
 * in between we use a soft off-white that reads on either side.
 *
 * Supports `#rgb` / `#rrggbb` and `hsl(h s% l%)` inputs (HSL is converted
 * inline; we don't pull in the ColorSwatches helpers to keep this component
 * dependency-light).
 */
function pickLabelColor(laneColor: string, opacityPct: number): string {
  const alpha = Math.max(0, Math.min(1, opacityPct / 100));
  // Blend the lane colour toward white by (1 - alpha). We approximate this by
  // resolving both ends to RGB and lerping.
  const laneRgb = colorToRgb(laneColor);
  if (!laneRgb) return `rgba(255, 255, 255, ${Math.min(1, alpha + 0.6)})`;
  const r = Math.round(laneRgb.r + (255 - laneRgb.r) * (1 - alpha));
  const g = Math.round(laneRgb.g + (255 - laneRgb.g) * (1 - alpha));
  const b = Math.round(laneRgb.b + (255 - laneRgb.b) * (1 - alpha));
  // ITU-R BT.601 luma, 0..1.
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luma > 0.6) return "rgba(255, 255, 255, 0.95)";
  if (luma < 0.3) {
    const lr = Math.round(laneRgb.r * 0.55);
    const lg = Math.round(laneRgb.g * 0.55);
    const lb = Math.round(laneRgb.b * 0.55);
    return `rgb(${lr}, ${lg}, ${lb})`;
  }
  return "rgba(255, 255, 255, 0.92)";
}

function colorToRgb(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    if (hex.length < 6) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const hsl = trimmed.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/);
  if (hsl) {
    const h = parseFloat(hsl[1]) / 360;
    const s = parseFloat(hsl[2]) / 100;
    const l = parseFloat(hsl[3]) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return {
      r: Math.round(f(0) * 255),
      g: Math.round(f(8) * 255),
      b: Math.round(f(4) * 255),
    };
  }
  return null;
}

const UNPARENT_BORDER = "hsl(25 95% 53%)";

const SwimlaneNode = memo((props: NodeProps<Node<SwimlaneNodeData>>) => {
  const { data, selected, dragging } = props;
  const d = data as SwimlaneNodeData;
  const isResizing =
    "resizing" in props ? Boolean((props as NodeProps & { resizing?: boolean }).resizing) : false;
  const { t } = useTranslation();
  const { highlightedNodeIds } = useHandleHighlight();
  const isHorizontal = d.orientation !== "vertical";
  const laneColor = d.laneColor || "#6366f1";
  const opacityPct = Math.max(0, Math.min(100, d.opacity ?? DEFAULT_SWIMLANE_OPACITY));
  const fill = withAlpha(laneColor, opacityPct);
  const labelText = d.laneLabel?.trim() || d.name?.trim() || t("swimlane.defaultLaneLabel");
  const labelColor = pickLabelColor(laneColor, opacityPct);

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
          ...(isUnparentCandidate ? { borderColor: UNPARENT_BORDER } : {}),
        }}
      >
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}
        {d.compareBadges && <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
        {!d.compareBadges && d.sceneBadge && (
          <SceneElementBadge name={d.sceneBadge.name} color={d.sceneBadge.color} />
        )}
        <div
          className={`absolute z-[1] pointer-events-none ${
            isHorizontal
              ? "left-0 top-0 bottom-0 w-1 rounded-l-lg"
              : "top-0 left-0 right-0 h-1 rounded-t-lg"
          }`}
          style={{ background: isUnparentCandidate ? UNPARENT_BORDER : laneColor }}
        />
        {isDragTarget && (
          <div
            className="absolute inset-0 rounded-lg animate-pulse-glow pointer-events-none z-0"
            style={{ boxShadow: `0 0 20px 4px ${withAlpha(laneColor, 50)}` }}
          />
        )}
        <div
          className={`absolute z-[2] ${
            isHorizontal
              ? "left-3 top-1/2 -translate-y-1/2 -rotate-90"
              : "top-2 left-1/2 -translate-x-1/2"
          } text-[11px] font-semibold uppercase tracking-widest select-none whitespace-nowrap max-w-[calc(100%-2rem)] truncate`}
          style={{ color: labelColor }}
        >
          {labelText}
        </div>
        <div
          className={isHorizontal ? "pl-8 p-3 h-full min-h-[48px]" : "pt-7 p-3 h-full min-h-[48px]"}
        />
      </div>
    </>
  );
});

SwimlaneNode.displayName = "SwimlaneNode";

export default SwimlaneNode;
