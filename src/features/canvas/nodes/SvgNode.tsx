import { memo } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration/useCollabHighlight";

const HANDLE_BASE =
  "!border-background transition-all duration-150 !w-2.5 !h-2.5 !bg-muted-foreground";

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
        minWidth={80}
        minHeight={80}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <div
        aria-label={t("svgNode.aria", { name: d.name })}
        className={`relative w-full h-full min-h-0 transition-shadow duration-200 ${
          isActive
            ? "ring-2 ring-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]"
            : "opacity-90"
        }`}
      >
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
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
          className="w-full h-full min-h-0 flex items-center justify-center overflow-hidden [&_svg]:block [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-full [&_svg]:w-full"
          style={{ pointerEvents: "none" }}
          // svgContent is sanitized before being stored in SvgComponent
          dangerouslySetInnerHTML={{ __html: d.svgContent }}
        />
        <Handle
          id="target-0"
          type="target"
          position={Position.Left}
          className={HANDLE_BASE}
        />
        <Handle
          id="source-0"
          type="source"
          position={Position.Right}
          className={HANDLE_BASE}
        />
      </div>
    </>
  );
});

SvgNode.displayName = "SvgNode";

export default SvgNode;
