import { useTranslation } from "react-i18next";
import type { PointerEvent as ReactPointerEvent } from "react";
import { EdgeLabelPortal } from "../EdgeLabelPortal";

/**
 * Stacking of an edge label, inside the viewport's stacking context.
 *
 * Labels sit above edges and below elements (audit D1). React Flow renders the
 * label layer after the edges and before the nodes, so at the cards' default
 * `zIndex` of 1 the DOM order decides: the card wins. At 2, a label that overlapped a
 * card (most often one revealed by selecting a neighbour at far zoom) took the
 * click meant for the card, so a Shift-click selected the edge and cleared the
 * node selection instead of adding the card.
 */
export const EDGE_LABEL_Z_INDEX = 1;

export interface EdgeLabelProps {
  labelPoint: { x: number; y: number };
  label: string;
  technology?: string;
  isHighlighted: boolean;
  /** Shown even when the canvas is zoomed out far enough to hide edge labels. */
  revealed?: boolean;
  stepBadges?: string[];
  isLastRecorded?: boolean;
  coverageFlowNames?: string[];
  playbackDuration?: string;
  dragPath: SVGPathElement | null;
  labelPosition: number;
  connectionId: string;
  canDrag: boolean;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function EdgeLabel({
  labelPoint,
  label,
  technology,
  isHighlighted,
  revealed = false,
  stepBadges,
  isLastRecorded,
  coverageFlowNames,
  playbackDuration,
  dragPath,
  labelPosition,
  connectionId,
  canDrag,
  onDragStart,
  onDragMove,
  onDragEnd,
}: EdgeLabelProps) {
  const { t } = useTranslation();

  return (
    <EdgeLabelPortal>
      <div
        className={`nodrag nopan absolute pointer-events-auto ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
        data-edge-label=""
        data-revealed={revealed ? "true" : undefined}
        data-connection-id={connectionId}
        data-label-position={labelPosition}
        data-drag-hit-path={dragPath ? "1" : "0"}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        style={{
          zIndex: EDGE_LABEL_Z_INDEX,
          transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y}px) scale(var(--edge-label-scale, 1))`,
        }}
      >
        <div
          className={`relative rounded-md px-2 py-1 text-[10px] font-medium border transition-colors ${
            isHighlighted
              ? "bg-primary/15 border-primary/30 text-primary"
              : "bg-card border-border text-muted-foreground"
          }`}
          title={
            [
              label.trim().length > 0 ? label : null,
              coverageFlowNames?.length
                ? t("customEdge.coveredBy", { names: coverageFlowNames.join(", ") })
                : null,
            ]
              .filter((part): part is string => !!part && part.length > 0)
              .join("\n\n") || undefined
          }
        >
          {stepBadges && stepBadges.length > 0 && (
            <div
              className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-0.5 ${isLastRecorded ? "animate-pulse" : ""}`}
            >
              {stepBadges.join(",")}
            </div>
          )}
          <span className="block max-w-[160px] truncate">{label}</span>
          {playbackDuration && (
            <span className="ml-1 font-mono text-primary">· {playbackDuration}</span>
          )}
          {technology && (
            <span className="block mt-0.5 font-mono text-[9px] bg-secondary px-1 rounded w-fit">
              {technology}
            </span>
          )}
        </div>
      </div>
    </EdgeLabelPortal>
  );
}
