import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Box, Play, Star } from "lucide-react";
import type { Diagram } from "@/features/diagram";
import { formatTimestamp } from "@/lib/core/format-timestamp";
import { cn } from "@/lib/utils";
import { levelColors } from "@/pages/dashboard/dashboard.constants";
import { StatChip } from "./StatChip";

export interface DiagramCardFooterProps {
  diagram: Diagram;
  levelLabels: Record<string, string>;
  componentCount: number;
  connectionCount: number;
  flowCount: number;
  isFavorite?: boolean;
  onToggleFavorite?: (diagramId: string) => void;
}

export function DiagramCardFooter({
  diagram,
  levelLabels,
  componentCount,
  connectionCount,
  flowCount,
  isFavorite = false,
  onToggleFavorite,
}: DiagramCardFooterProps) {
  const { t } = useTranslation();

  const handleFavoriteClick = (event: MouseEvent) => {
    event.stopPropagation();
    onToggleFavorite?.(diagram.id);
  };

  return (
    <div className="p-3">
      <div className="mb-1 flex items-start gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {diagram.name}
        </p>
        {onToggleFavorite ? (
          <button
            type="button"
            onClick={handleFavoriteClick}
            className={cn(
              "mt-0.5 shrink-0 rounded p-0.5 transition-colors",
              isFavorite
                ? "text-amber-500 hover:text-amber-600"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
            aria-label={
              isFavorite ? t("dashboard.unfavoriteDiagram") : t("dashboard.favoriteDiagram")
            }
            title={isFavorite ? t("dashboard.unfavoriteDiagram") : t("dashboard.favoriteDiagram")}
          >
            <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
          </button>
        ) : null}
      </div>
      <div className="mb-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            levelColors[diagram.level] ?? "bg-muted text-muted-foreground",
          )}
        >
          {levelLabels[diagram.level]}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2.5">
        <StatChip
          icon={<Box size={11} />}
          value={componentCount}
          label={t("dashboard.card.components")}
        />
        <StatChip
          icon={<ArrowRight size={11} />}
          value={connectionCount}
          label={t("dashboard.card.connections")}
        />
        <StatChip icon={<Play size={11} />} value={flowCount} label={t("dashboard.card.flows")} />
      </div>
      <p
        className="text-[11px] text-muted-foreground/70"
        title={`${t("common.created")}: ${formatTimestamp(diagram.createdAt)}`}
      >
        {formatTimestamp(diagram.updatedAt)}
      </p>
    </div>
  );
}
