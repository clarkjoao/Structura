import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCollabHighlight } from "@/features/collaboration";

export type ExternalElementNodeData = {
  elementId: string;
  name: string;
  linkedDiagramId?: string;
  linkedElementId?: string;
  linkedElementName?: string;
  linkedDiagramName?: string;
  isSelected: boolean;
  onOpenInCanvas?: () => void;
};

const handleClass =
  "!border-background transition-all duration-150 !w-2.5 !h-2.5 !bg-muted-foreground";

const ExternalElementNode = memo(
  ({ data: d, selected }: NodeProps<Node<ExternalElementNodeData>>) => {
    const isSelected = selected || d.isSelected;
    const collabHighlight = useCollabHighlight(d.elementId);
    const { t } = useTranslation();

    const displayName = d.linkedElementName || d.name || t("externalElement.nodeFallbackName");
    const diagramName = d.linkedDiagramName;

    const handleOpenNewTab = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!d.linkedDiagramId) return;
      const nodeParam = d.linkedElementId ? `?nodeId=${d.linkedElementId}` : "";
      window.open(`/model/${d.linkedDiagramId}${nodeParam}`, "_blank");
    };

    const handleOpenInCanvas = (e: React.MouseEvent) => {
      e.stopPropagation();
      d.onOpenInCanvas?.();
    };

    const hasLink = !!d.linkedDiagramId;

    return (
      <div
        className={[
          "relative rounded-lg border-2 border-dashed bg-muted/20 min-w-[200px] max-w-[260px] px-3 py-2.5 transition-shadow",
          isSelected
            ? "border-primary/70 shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]"
            : "border-muted-foreground/40 hover:border-muted-foreground/60",
        ].join(" ")}
      >
        <Handle id="target-0" type="target" position={Position.Left} className={handleClass} />
        <Handle id="source-0" type="source" position={Position.Right} className={handleClass} />

        {collabHighlight && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg z-10"
            style={{ boxShadow: `inset 0 0 0 2px ${collabHighlight.color}` }}
          />
        )}

        <span className="absolute -top-2 left-2 bg-background px-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {t("externalElement.nodeBadge")}
        </span>

        <div className="flex items-start gap-2">
          <ExternalLink className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold text-foreground leading-tight block truncate">
              {displayName}
            </span>
            {diagramName && (
              <span className="text-[11px] text-muted-foreground block truncate mt-0.5">
                {t("externalElement.nodeFromDiagram", { name: diagramName })}
              </span>
            )}
            {!diagramName && !d.linkedDiagramId && (
              <span className="text-[11px] text-muted-foreground/60 italic block mt-0.5">
                {t("externalElement.nodeNotLinked")}
              </span>
            )}
          </div>
        </div>

        {hasLink && (
          <div className="mt-2 flex items-center gap-1.5">
            {d.onOpenInCanvas && (
              <button
                type="button"
                onClick={handleOpenInCanvas}
                className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                <ArrowUpRight className="h-3 w-3" />
                {t("externalElement.nodeOpenInCanvas")}
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenNewTab}
              title={t("externalElement.nodeOpenNewTab")}
              className={[
                "flex items-center justify-center rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
                d.onOpenInCanvas ? "" : "flex-1 gap-1",
              ].join(" ")}
            >
              <ExternalLink className="h-3 w-3" />
              {!d.onOpenInCanvas && <span>{t("externalElement.nodeOpenNewTab")}</span>}
            </button>
          </div>
        )}
      </div>
    );
  },
);

ExternalElementNode.displayName = "ExternalElementNode";

export default ExternalElementNode;
