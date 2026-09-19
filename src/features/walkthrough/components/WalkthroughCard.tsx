import { useNavigate } from "react-router-dom";
import { Play, Pencil, Trash2, Clapperboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import { useDiagramStore } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  presentation: WalkthroughPresentation;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function WalkthroughCard({ presentation, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const diagrams = useDiagramStore((s) => s.diagrams);

  // Collect unique diagram ids across steps
  const diagramIds = [...new Set(presentation.steps.map((s) => s.diagramId))];
  const existingDiagramIds = diagramIds.filter((id) => !!diagrams[id]);

  const hasInvalidDiagrams = existingDiagramIds.length < diagramIds.length;

  const lastUpdated = new Date(presentation.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {presentation.title || t("walkthrough.untitled", "Untitled Walkthrough")}
          </h3>
          {presentation.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {presentation.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
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
            className="h-7 w-7 text-destructive hover:text-destructive"
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

      {/* Diagram chips */}
      {existingDiagramIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {existingDiagramIds.slice(0, 5).map((id) => (
            <Badge
              key={id}
              variant="secondary"
              className="gap-1 text-[10px] font-normal"
            >
              <Clapperboard className="h-2.5 w-2.5" />
              <span className="truncate max-w-[100px]">
                {diagrams[id]?.name ?? id.slice(0, 8)}
              </span>
            </Badge>
          ))}
          {diagramIds.length > 5 && (
            <Badge variant="outline" className="text-[10px] font-normal">
              +{diagramIds.length - 5}
            </Badge>
          )}
          {hasInvalidDiagrams && (
            <Badge variant="destructive" className="text-[10px] font-normal">
              {t("walkthrough.someDiagramsMissing", "some diagrams missing")}
            </Badge>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {presentation.steps.length}{" "}
          {presentation.steps.length === 1
            ? t("walkthrough.scene_one", "scene")
            : t("walkthrough.scene_other", "scenes")}{" "}
          · {existingDiagramIds.length}{" "}
          {existingDiagramIds.length === 1
            ? t("walkthrough.diagram_one", "diagram")
            : t("walkthrough.diagram_other", "diagrams")}
        </span>
        <span>{lastUpdated}</span>
      </div>

      <Button
        className="w-full gap-1.5"
        size="sm"
        onClick={() => navigate(`/walkthrough/${presentation.id}/step/0`)}
        disabled={presentation.steps.length === 0}
      >
        <Play className="h-3.5 w-3.5" />
        {t("walkthrough.play", "Play")}
      </Button>
    </div>
  );
}
