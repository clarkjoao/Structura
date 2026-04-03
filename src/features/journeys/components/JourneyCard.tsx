import { useMemo, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { Play, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Journey } from "../types";

interface JourneyCardProps {
  journey: Journey;
  onEdit: () => void;
  onDelete: () => void;
}

function countUniqueDiagramIds(journey: Journey): number {
  const ids = new Set<string>();
  for (const step of Object.values(journey.steps)) {
    if (step.diagramId) ids.add(step.diagramId);
  }
  return ids.size;
}

export function JourneyCard({ journey, onEdit, onDelete }: JourneyCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("pt") ? ptBR : enUS;

  const stepCount = Object.keys(journey.steps).length;
  const diagramCount = useMemo(
    () => countUniqueDiagramIds(journey),
    [journey],
  );

  const relativeTime = formatDistanceToNow(journey.updatedAt, {
    addSuffix: true,
    locale,
  });

  const handleDeleteClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(t("journeys.deleteConfirm"))) {
      onDelete();
    }
  };

  const handleEditClick = (event: MouseEvent) => {
    event.stopPropagation();
    onEdit();
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border border-border bg-card p-4 transition-all",
        "hover:border-primary/30 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]",
      )}
    >
      <div
        className={cn(
          "absolute right-3 top-3 flex gap-1 rounded-md border border-border bg-card/95 p-0.5 shadow-sm backdrop-blur-sm",
          "opacity-0 transition-opacity group-hover:opacity-100",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={t("common.edit")}
          onClick={handleEditClick}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={t("common.delete")}
          onClick={handleDeleteClick}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <h3 className="pr-20 font-semibold text-foreground">{journey.name}</h3>

      {journey.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {journey.description}
        </p>
      ) : null}

      {journey.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {journey.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {t("journeys.stepsCount", { count: stepCount })}
          <span className="mx-1.5">·</span>
          {t("journeys.diagramsCount", { count: diagramCount })}
          <span className="mx-1.5">·</span>
          {relativeTime}
        </p>
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={t("common.open")}
          onClick={onEdit}
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
