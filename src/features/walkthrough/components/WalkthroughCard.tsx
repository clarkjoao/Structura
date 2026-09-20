import { useNavigate } from "react-router-dom";
import { Play, Pencil, Trash2, FolderOpen, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import { useDiagramStore, useAllFolders } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WALKTHROUGH_DRAG_MIME } from "@/components/folders/dragTypes";

interface Props {
  presentation: WalkthroughPresentation;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export function WalkthroughCard({
  presentation,
  onEdit,
  onDelete,
  isFavorite,
  onToggleFavorite,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const diagrams = useDiagramStore((s) => s.diagrams);
  const folders = useAllFolders();
  const folder = presentation.folderId
    ? folders.find((f) => f.id === presentation.folderId)
    : undefined;

  // Collect unique diagram ids across steps
  const diagramIds = [...new Set(presentation.steps.map((s) => s.diagramId))];
  const existingDiagramIds = diagramIds.filter((id) => !!diagrams[id]);
  const hasInvalidDiagrams = existingDiagramIds.length < diagramIds.length;

  const lastUpdated = new Date(presentation.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const stepCount = presentation.steps.length;
  const diagramCount = existingDiagramIds.length;

  const handleOpenPlayer = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/workflow/${presentation.id}/step/0`);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(presentation.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(presentation.id);
  };

  const handleCardOpen = () => {
    // Consistent with the rest of the library listings: click opens edit.
    onEdit(presentation.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        // The walkthrough's own type, so the diagram rail never accepts this card.
        e.dataTransfer.setData(WALKTHROUGH_DRAG_MIME, presentation.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={handleCardOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardOpen();
        }
      }}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors",
        "cursor-pointer hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      {/* Title row */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {presentation.title || t("walkthrough.untitled")}
          </h3>
          {presentation.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {presentation.description}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-pressed={isFavorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(presentation.id);
          }}
          title={t("walkthrough.favorite")}
        >
          <Star
            className={cn(
              "h-3.5 w-3.5",
              isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
            )}
          />
        </Button>

        {/* Secondary actions (visible on hover) */}
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleOpenPlayer}
            disabled={stepCount === 0}
            title={t("walkthrough.play")}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleEditClick}
            title={t("walkthrough.edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDeleteClick}
            title={t("walkthrough.delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Folder badge */}
      {folder && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FolderOpen className="h-3 w-3" />
          <span className="truncate">{folder.name}</span>
        </div>
      )}

      {/* Stats row + missing-diagrams warning */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span>
            {stepCount}{" "}
            {stepCount === 1 ? t("walkthrough.scene_one") : t("walkthrough.scene_other")}
          </span>
          <span aria-hidden>·</span>
          <span>
            {diagramCount}{" "}
            {diagramCount === 1 ? t("walkthrough.diagram_one") : t("walkthrough.diagram_other")}
          </span>
          {hasInvalidDiagrams && (
            <Badge variant="destructive" className="ml-1 text-[10px] font-normal">
              {t("walkthrough.someDiagramsMissing")}
            </Badge>
          )}
        </span>
        <span>{lastUpdated}</span>
      </div>
    </div>
  );
}
