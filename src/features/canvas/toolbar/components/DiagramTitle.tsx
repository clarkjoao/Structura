import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp } from "lucide-react";
import type { Diagram } from "@/features/diagram";

export interface DiagramTitleProps {
  diagram: Pick<Diagram, "name" | "level">;
  /** Back to the diagram this one was drilled into from, when there is one. */
  onDrillUp?: () => void;
}

/**
 * The diagram's name and C4 level in the page header, with the arrow up a level. Read only:
 * the name and description are edited in the diagram's side panel.
 */
export function DiagramTitle({ diagram, onDrillUp }: DiagramTitleProps) {
  const { t } = useTranslation();

  const levelLabel = useMemo(
    () =>
      ({
        context: t("canvasToolbar.levelContext"),
        container: t("canvasToolbar.levelContainer"),
        component: t("canvasToolbar.levelComponent"),
        deployment: t("canvasToolbar.levelDeployment"),
      })[diagram.level],
    [t, diagram.level],
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      {onDrillUp && (
        <button
          type="button"
          onClick={onDrillUp}
          title={t("canvasToolbar.drillUp")}
          aria-label={t("canvasToolbar.drillUp")}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronUp aria-hidden className="h-4 w-4" />
        </button>
      )}
      {/* The full name, since a long one is cut short here. */}
      <span title={diagram.name} className="min-w-0 truncate font-medium">
        {diagram.name}
      </span>
      {levelLabel && (
        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {levelLabel}
        </span>
      )}
    </div>
  );
}
