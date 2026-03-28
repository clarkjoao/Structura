import { memo } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration/useCollabHighlight";

export interface SvgNodeData {
  elementId: string;
  name: string;
  svgContent: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
}

const SVG_ACCENT = "#f97316";

const SvgNode = memo(({ data, selected }: NodeProps) => {
  const { t } = useTranslation();
  const d = data as unknown as SvgNodeData;
  const { highlightedNodeIds } = useHandleHighlight();
  const isSelected = selected || d.isSelected;
  const isHighlighted =
    (d.isHighlighted ?? false) || highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;
  const collabHighlight = useCollabHighlight(d.elementId);

  return (
    <>
      <NodeResizer
        minWidth={120}
        minHeight={120}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />

      <Handle
        id="target-0"
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !border-2 !border-background !bg-muted-foreground"
      />
      <Handle
        id="source-0"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !border-2 !border-background !bg-muted-foreground"
      />

      <div
        aria-label={t("svgNode.aria", { name: d.name })}
        className={`group relative w-full h-full rounded-lg bg-card border border-border border-l-[3px] transition-shadow duration-200 flex flex-col overflow-hidden ${
          isActive
            ? "ring-2 ring-primary shadow-[0_0_0_2px_rgba(59,130,246,0.4)] brightness-110"
            : "opacity-90"
        }`}
        style={{ borderLeftColor: SVG_ACCENT }}
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

        <div className="px-3 pt-2.5 pb-1 shrink-0">
          <span className="text-sm font-bold text-foreground leading-tight truncate block">
            {d.name || t("svgNode.defaultName")}
          </span>
        </div>

        <div
          className="flex-1 flex items-center justify-center px-3 pb-2.5 min-h-0 overflow-hidden [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto"
          style={{ pointerEvents: "none" }}
          // svgContent is sanitized before being stored in SvgComponent
          dangerouslySetInnerHTML={{ __html: d.svgContent }}
        />
      </div>
    </>
  );
});

SvgNode.displayName = "SvgNode";

export default SvgNode;
