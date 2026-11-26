import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsNodeHandleHighlighted } from "../contexts/highlightMembership";
import { CompareVersionBadges, VersionElementBadge } from "./VersionElementBadge";
import { DeployHandles } from "./DeployNodes/DeployParts";
import { useCollabHighlight } from "@/features/collaboration/hooks/useCollabHighlight";

export type UnknownNodeData = {
  elementId: string;
  name: string;
  rawContent?: string;
  /** The type the canvas could not draw; absent for an `unknown` component's own content. */
  originalType?: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  /** One slot a side per edge; see the element's `buildData`. */
  incomingCount?: number;
  outgoingCount?: number;
  versionBadge?: { name: string; color: string };
  compareBadges?: {
    a: { name: string; color: string };
    b: { name: string; color: string };
  };
};

const UnknownNode = memo(({ data: d, selected }: NodeProps<Node<UnknownNodeData>>) => {
  const { t } = useTranslation();
  const isHandleHighlighted = useIsNodeHandleHighlighted(d.elementId);
  const isSelected = selected || d.isSelected;
  const isHighlighted = (d.isHighlighted ?? false) || isHandleHighlighted;
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
      <DeployHandles
        elementId={d.elementId}
        incomingCount={d.incomingCount ?? 1}
        outgoingCount={d.outgoingCount ?? 1}
      />
      {/* Quiet on purpose: content kept as it came is not an error, only something the canvas
          cannot draw. The dashed outline says "placeholder"; the chip says what it was. */}
      <div
        aria-label={t("unknownNode.aria", { name: d.name })}
        title={t("unknownNode.badge")}
        className={`relative flex h-full w-full flex-col overflow-hidden rounded-lg border-[1.5px] border-dashed bg-card transition-shadow duration-200 ${
          isActive
            ? "border-primary ring-2 ring-primary/30"
            : "border-muted-foreground/45 hover:border-muted-foreground/70"
        }`}
      >
        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}
        {d.compareBadges && <CompareVersionBadges a={d.compareBadges.a} b={d.compareBadges.b} />}
        {!d.compareBadges && d.versionBadge && (
          <VersionElementBadge name={d.versionBadge.name} color={d.versionBadge.color} />
        )}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {d.name || t("unknownNode.defaultName")}
          </span>
        </div>
        <div className="px-3">
          <span className="inline-block max-w-full truncate rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {d.originalType ?? t("unknownNode.badge")}
          </span>
        </div>
        {d.rawContent ? (
          <div className="min-h-0 flex-1 overflow-hidden px-3 pt-2 pb-2.5">
            <pre className="line-clamp-4 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
              {d.rawContent}
            </pre>
          </div>
        ) : (
          <p className="mt-auto px-3 pb-2.5 text-[11px] text-muted-foreground">
            {t(d.originalType ? "unknownNode.cannotDraw" : "unknownNode.emptyHint")}
          </p>
        )}
      </div>
    </>
  );
});

UnknownNode.displayName = "UnknownNode";
export default UnknownNode;
