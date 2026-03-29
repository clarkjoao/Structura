import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { useTranslation } from "react-i18next";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration/useCollabHighlight";
import { useFlowMode } from "../flow/FlowModeContext";

export interface SwimlaneNodeData {
  elementId: string;
  name: string;
  orientation: "horizontal" | "vertical";
  laneColor: string;
  laneLabel: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  isDragTarget?: boolean;
  isUnparentCandidate?: boolean;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
}

const UNPARENT_BORDER = "hsl(25 95% 53%)";

function swimlaneFill(color: string): string {
  if (color.startsWith("#")) {
    const hex = color.replace("#", "").slice(0, 6);
    if (hex.length === 6) return `#${hex}18`;
  }
  return color;
}

const SwimlaneNode = memo(({ data, selected }: NodeProps) => {
  const { t } = useTranslation();
  const { isRecording, isPlaying } = useFlowMode();
  const canvasFlowLocked = isRecording || isPlaying;
  const d = data as unknown as SwimlaneNodeData;
  const { highlightedNodeIds } = useHandleHighlight();
  const isHorizontal = d.orientation !== "vertical";
  const laneColor = d.laneColor || "#6366f1";
  const fill = swimlaneFill(laneColor);
  const labelText =
    d.laneLabel?.trim() || d.name?.trim() || t("swimlane.defaultLaneLabel");

  const isSelected = selected || d.isSelected;
  const isHighlighted =
    (d.isHighlighted ?? false) || highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;
  const isDragTarget = d.isDragTarget;
  const isUnparentCandidate = d.isUnparentCandidate ?? false;
  const collabHighlight = useCollabHighlight(d.elementId);

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={isSelected && !canvasFlowLocked}
        lineClassName="!border-transparent"
        handleClassName="!w-2.5 !h-2.5 !border-background !rounded-sm"
        handleStyle={{ backgroundColor: laneColor }}
      />
      <div
        className={`relative w-full h-full rounded-lg border transition-all duration-200 ${
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
        {d.compareBadges && (
          <CompareSceneBadges a={d.compareBadges.a} b={d.compareBadges.b} />
        )}
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
            style={{ boxShadow: `0 0 20px 4px ${laneColor}80` }}
          />
        )}
        <div
          className={`absolute z-[2] ${
            isHorizontal
              ? "left-3 top-1/2 -translate-y-1/2 -rotate-90"
              : "top-2 left-1/2 -translate-x-1/2"
          } text-[11px] font-semibold uppercase tracking-widest text-muted-foreground select-none whitespace-nowrap max-w-[calc(100%-2rem)] truncate`}
        >
          {labelText}
        </div>
        <div className={isHorizontal ? "pl-8 p-3 h-full min-h-[48px]" : "pt-7 p-3 h-full min-h-[48px]"} />
      </div>
    </>
  );
});

SwimlaneNode.displayName = "SwimlaneNode";

export default SwimlaneNode;
