import { EdgeLabelRenderer } from "@xyflow/react";
import { RotateCcw, Spline, Trash2, Waypoints } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Point } from "@/features/diagram";

interface EdgeToolbarProps {
  anchor: Point;
  canReset: boolean;
  /** Current routing of an editable edge, or `null` for non-editable styles. */
  routing: "curve" | "step" | null;
  onToggleRouting: () => void;
  onReset: () => void;
  onDelete: () => void;
}

/** Floating actions anchored above a selected edge. */
export function EdgeToolbar({
  anchor,
  canReset,
  routing,
  onToggleRouting,
  onReset,
  onDelete,
}: EdgeToolbarProps) {
  const { t } = useTranslation();
  // The icon/label describe the routing you switch *to*.
  const toggleLabel =
    routing === "curve" ? t("customEdge.routeAsStep") : t("customEdge.routeAsCurve");

  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan absolute z-[3] pointer-events-auto flex items-center gap-0.5
                   rounded-md border border-border bg-card px-1 py-0.5 shadow-lg"
        style={{
          transform: `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y - 28}px)`,
        }}
      >
        {routing && (
          <button
            type="button"
            title={toggleLabel}
            aria-label={toggleLabel}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground
                       transition-colors hover:bg-surface-hover hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onToggleRouting();
            }}
          >
            {routing === "curve" ? (
              <Waypoints className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Spline className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        )}
        {canReset && (
          <button
            type="button"
            title={t("customEdge.resetPoints")}
            aria-label={t("customEdge.resetPoints")}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground
                       transition-colors hover:bg-surface-hover hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onReset();
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          title={t("customEdge.deleteEdge")}
          aria-label={t("customEdge.deleteEdge")}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground
                     transition-colors hover:bg-destructive/10 hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </EdgeLabelRenderer>
  );
}
