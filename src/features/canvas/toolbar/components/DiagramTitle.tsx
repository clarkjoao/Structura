import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronUp } from "lucide-react";
import type { Diagram } from "@/features/diagram";

export interface DiagramTitleProps {
  diagram: Pick<Diagram, "name" | "level">;
  /** Back to the diagram this one was drilled into from, when there is one. */
  onDrillUp?: () => void;
  /** The diagrams drilled down through to this one, outermost first (a breadcrumb). */
  trail?: ReadonlyArray<{ id: string; name: string }>;
  /** Back to the diagram at that index of `trail`. */
  onOpenTrail?: (index: number) => void;
  /** The Version the canvas shows, beside the name. */
  version?: { name: string; color: string } | null;
}

/**
 * The diagram's name and C4 level in the page header, with the arrow up a level. Read only:
 * the name and description are edited in the diagram's side panel.
 */
export function DiagramTitle({
  diagram,
  onDrillUp,
  trail = [],
  onOpenTrail,
  version,
}: DiagramTitleProps) {
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
      {trail.length > 0 && (
        <nav aria-label={t("canvasToolbar.trail")} className="flex min-w-0 items-center gap-1">
          {trail.map((crumb, index) => (
            <span key={`${crumb.id}:${index}`} className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenTrail?.(index)}
                title={crumb.name}
                className="min-w-0 max-w-[10rem] truncate rounded px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {crumb.name}
              </button>
              <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </span>
          ))}
        </nav>
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
      {version && (
        <span
          title={t("canvasToolbar.showingVersion", { name: version.name })}
          className="flex min-w-0 shrink items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: version.color }}
          />
          <span className="max-w-[10rem] truncate">{version.name}</span>
        </span>
      )}
    </div>
  );
}
