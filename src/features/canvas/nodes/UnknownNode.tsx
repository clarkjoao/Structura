import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHandleHighlight } from "../contexts/HandleHighlightContext";
import { CompareSceneBadges, SceneElementBadge } from "./SceneElementBadge";
import { useCollabHighlight } from "@/features/collaboration";

export interface UnknownNodeData {
  elementId: string;
  name: string;
  rawContent?: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  sceneBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
}

const UnknownNode = memo(({ data, selected }: NodeProps) => {
  const { t } = useTranslation();
  const d = data as unknown as UnknownNodeData;
  const { highlightedNodeIds } = useHandleHighlight();
  const isSelected = selected || d.isSelected;
  const isHighlighted = (d.isHighlighted ?? false) || highlightedNodeIds.has(d.elementId);
  const isActive = isSelected || isHighlighted;
  const collabHighlight = useCollabHighlight(d.elementId);

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={isSelected}
        lineClassName="!border-transparent"
        handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
      />
      <div
        aria-label={t("unknownNode.aria", { name: d.name })}
        className={`relative flex flex-col w-full h-full overflow-hidden rounded-lg border-2 border-dashed transition-shadow duration-200 ${
          isActive
            ? "ring-2 ring-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]"
            : "opacity-90"
        }`}
        style={{
          borderColor: "#f97316",
          backgroundColor: "hsl(var(--card))",
        }}
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

        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-dashed border-orange-300/50">
          <CircleHelp className="h-4 w-4 shrink-0 text-orange-400" />
          <span className="text-xs font-medium truncate flex-1 text-muted-foreground">
            {d.name || t("unknownNode.defaultName")}
          </span>
          <span className="text-[9px] font-mono rounded bg-orange-100 dark:bg-orange-950/40 text-orange-500 px-1.5 py-0.5 shrink-0">
            {t("unknownNode.badge")}
          </span>
        </div>

        {/* Content */}
        {d.rawContent ? (
          <div className="flex-1 overflow-auto px-3 py-2 min-h-0">
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono leading-relaxed">
              {d.rawContent}
            </pre>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-3 py-2">
            <p className="text-xs italic text-muted-foreground text-center">
              {t("unknownNode.emptyHint")}
            </p>
          </div>
        )}
      </div>
    </>
  );
});

UnknownNode.displayName = "UnknownNode";
export default UnknownNode;
