import { useNavigate } from "react-router-dom";
import { Play, Pencil, Trash2, Star, Clapperboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WALKTHROUGH_DRAG_MIME } from "@/components/folders/dragTypes";
import type { Folder } from "@/features/diagram";
import type { WalkthroughPresentation } from "../model/walkthrough.types";

interface Props {
  items: WalkthroughPresentation[];
  folders: Record<string, Folder>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  favoriteIds: ReadonlySet<string>;
  onToggleFavorite: (id: string) => void;
}

/**
 * The same walkthroughs as the card grid, in rows.
 *
 * A denser reading for a long library: title, folder and scene count on one
 * line, so a reader scanning for one of forty is not paging through cards.
 */
export function WalkthroughList({
  items,
  folders,
  onEdit,
  onDelete,
  favoriteIds,
  onToggleFavorite,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border pb-0 mb-5">
      {items.map((presentation) => {
        const folder = presentation.folderId ? folders[presentation.folderId] : undefined;
        const isFavorite = favoriteIds.has(presentation.id);
        const stepCount = presentation.steps.length;

        return (
          <div
            key={presentation.id}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(WALKTHROUGH_DRAG_MIME, presentation.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onEdit(presentation.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit(presentation.id);
              }
            }}
            className="group flex cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Clapperboard className="h-4 w-4 shrink-0 text-primary" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {presentation.title || t("walkthrough.untitled", "Untitled Walkthrough")}
              </p>
              {presentation.description && (
                <p className="truncate text-xs text-muted-foreground">{presentation.description}</p>
              )}
            </div>

            {folder && (
              <span className="hidden shrink-0 truncate text-[11px] text-muted-foreground sm:block">
                {folder.name}
              </span>
            )}

            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              {stepCount}{" "}
              {stepCount === 1
                ? t("walkthrough.scene_one", "scene")
                : t("walkthrough.scene_other", "scenes")}
            </span>

            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-pressed={isFavorite}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(presentation.id);
                }}
                title={t("walkthrough.favorite", "Favorite")}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                disabled={stepCount === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/walkthrough/${presentation.id}/step/0`);
                }}
                title={t("walkthrough.play", "Play")}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(presentation.id);
                }}
                title={t("walkthrough.edit", "Edit")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(presentation.id);
                }}
                title={t("walkthrough.delete", "Delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
