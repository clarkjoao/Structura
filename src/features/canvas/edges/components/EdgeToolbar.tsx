import { EdgeLabelRenderer } from "@xyflow/react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EdgeStyle, EdgeMarker, Point } from "@/features/diagram";
import {
  ColorPicker,
  EdgeStyleDropdown,
  MarkerCapsDropdown,
} from "@/features/canvas/selection-actions";
import {
  dropdownToEdgeStyle,
  edgeStyleToDropdown,
} from "@/features/canvas/selection-actions/edgeStyleMapping";

interface EdgeToolbarProps {
  anchor: Point;
  canReset: boolean;
  onReset: () => void;
  onDelete: () => void;
  // Extended style controls
  edgeStyle?: EdgeStyle;
  edgeColor?: string;
  markerStart?: EdgeMarker;
  markerEnd?: EdgeMarker;
  onStyleChange?: (style: EdgeStyle) => void;
  onColorChange?: (color: string) => void;
  onMarkerStartChange?: (cap: EdgeMarker) => void;
  onMarkerEndChange?: (cap: EdgeMarker) => void;
}

/** Floating actions anchored above a selected edge. */
export function EdgeToolbar({
  anchor,
  canReset,
  onReset,
  onDelete,
  edgeStyle,
  edgeColor,
  markerStart,
  markerEnd,
  onStyleChange,
  onColorChange,
  onMarkerStartChange,
  onMarkerEndChange,
}: EdgeToolbarProps) {
  const { t } = useTranslation();

  const hasStyleControls = !!onStyleChange;

  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan absolute z-[3] pointer-events-auto flex items-center gap-0.5
                   rounded-md border border-border bg-card px-1 py-0.5 shadow-lg"
        style={{
          transform: `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y - 28}px)`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Style controls — only when callback provided */}
        {hasStyleControls && (
          <>
            <EdgeStyleDropdown
              currentStyle={edgeStyleToDropdown(edgeStyle)}
              onChangeStyle={(displayValue) => {
                onStyleChange!(dropdownToEdgeStyle(displayValue));
              }}
            />
            <ColorPicker selectedColor={edgeColor} onSelectColor={onColorChange!} />
            <MarkerCapsDropdown
              currentCap={markerStart}
              onChangeCap={onMarkerStartChange!}
              capType="start"
            />
            <MarkerCapsDropdown
              currentCap={markerEnd}
              onChangeCap={onMarkerEndChange!}
              capType="end"
            />
          </>
        )}

        {/* Reset path — only when there are control points */}
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

        {/* Delete */}
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
