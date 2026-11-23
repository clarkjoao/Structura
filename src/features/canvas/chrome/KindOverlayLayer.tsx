import { ViewportPortal, useReactFlow } from "@xyflow/react";
import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { kindOverlayFor } from "@/features/diagram-kinds/overlay";
import { resolveKindText } from "@/features/diagram-kinds/context";
import { cn } from "@/lib/utils";
import type {
  KindCommandOutcome,
  KindOverlay,
  KindText,
} from "@/features/diagram-kinds/kind.types";
import { runKindOutcome } from "./kindElementActions";
import { OVERLAY_LABEL_DEPTH, overlayRect } from "@/features/diagram-kinds/overlay.geometry";

type Segment = KindOverlay["segments"][number];
type Separator = KindOverlay["separators"][number];

/** A phase segment that can be renamed in place: double-click, Enter commits, Esc cancels. */
function EditableSegment({
  segment,
  style,
  onSelect,
  onRun,
}: {
  segment: Segment;
  style: CSSProperties;
  onSelect: () => void;
  onRun: NonNullable<OverlayEditing["onRun"]>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  if (draft !== null) {
    const commit = () => {
      setDraft(null);
      if (draft.trim() !== segment.label && segment.rename) onRun(segment.rename(draft));
    };
    return (
      <input
        autoFocus
        value={draft}
        aria-label={t("diagramKinds.guided.phases.renameHint")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          event.stopPropagation();
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(null);
        }}
        onBlur={() => setDraft(null)}
        className={`${SEGMENT_CLASS} pointer-events-auto bg-card normal-case text-foreground outline-none ring-1 ring-primary`}
        style={{ ...style, writingMode: undefined }}
        data-testid="kind-overlay-segment-input"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={() => segment.rename && setDraft(segment.label)}
      title={segment.rename ? t("diagramKinds.guided.phases.renameHint") : undefined}
      className={`${SEGMENT_CLASS} pointer-events-auto hover:text-foreground`}
      style={style}
      data-testid="kind-overlay-segment"
    >
      {segment.label}
    </button>
  );
}

/**
 * A separator that can be dragged along the axis to move the start of the phase after
 * it (spec guided-direct-editing): snaps to the nearest place it may go, previews it,
 * and moves on release.
 */
function DraggableSeparator({
  overlay,
  separator,
  onRun,
}: {
  overlay: KindOverlay;
  separator: Separator;
  onRun: NonNullable<OverlayEditing["onRun"]>;
}) {
  const { t } = useTranslation();
  const { screenToFlowPosition } = useReactFlow();
  const [preview, setPreview] = useState<number | null>(null);
  const horizontal = overlay.axis === "x";
  const moves = separator.moves ?? [];
  const nearest = (event: PointerEvent) => {
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const along = horizontal ? point.x : point.y;
    return moves.reduce<(typeof moves)[number] | null>(
      (best, move) =>
        !best || Math.abs(move.along - along) < Math.abs(best.along - along) ? move : best,
      null,
    );
  };
  return (
    <>
      <div
        role="separator"
        aria-label={t("diagramKinds.guided.phases.moveHint")}
        title={t("diagramKinds.guided.phases.moveHint")}
        className={cn(
          "pointer-events-auto absolute",
          horizontal ? "cursor-col-resize" : "cursor-row-resize",
        )}
        style={css(overlayRect(overlay, separator.along - 6, 12, overlay.at, overlay.depth))}
        onPointerDown={(event) => {
          event.stopPropagation();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // A pointer the browser does not know (a synthetic one): dragging still works.
          }
          setPreview(nearest(event)?.along ?? null);
        }}
        onPointerMove={(event) => {
          if (preview === null) return;
          setPreview(nearest(event)?.along ?? null);
        }}
        onPointerUp={(event) => {
          const target = preview === null ? null : nearest(event);
          setPreview(null);
          if (target && Math.abs(target.along - separator.along) > 1) onRun(target.run());
        }}
        data-testid="kind-overlay-separator-handle"
      />
      {preview !== null && (
        <div
          className="absolute border-dashed border-primary"
          style={{
            ...css(overlayRect(overlay, preview, 0, separator.from, separator.to - separator.from)),
            ...(horizontal ? { borderLeftWidth: 2 } : { borderTopWidth: 2 }),
          }}
          data-testid="kind-overlay-separator-preview"
        />
      )}
    </>
  );
}

/** What an editable canvas lets the overlay do: run an edit the overlay offers. */
interface OverlayEditing {
  onRun?: (outcome: KindCommandOutcome | { refused: KindText }) => void;
}

const SEGMENT_CLASS =
  "absolute flex items-center justify-center truncate rounded-md border border-border bg-card/90 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm";

/** A rectangle as absolute CSS in flow units. */
function css(rect: { x: number; y: number; width: number; height: number }): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

/**
 * A kind overlay drawn inside the viewport (spec guided-journey-phases): the
 * phase band, the separators across the lanes and the lines between lanes. It is not
 * an element, so it cannot be selected, moved or exported as a node. With
 * `onSelectElement`, clicking a phase selects the step it starts at; without
 * it (read-only surfaces) the segments are plain labels.
 */
export function KindOverlayView({
  overlay,
  onSelectElement,
  onRun,
}: {
  overlay: KindOverlay;
  onSelectElement?: (id: string) => void;
} & OverlayEditing) {
  const horizontal = overlay.axis === "x";

  return (
    <div className="pointer-events-none" data-testid="kind-overlay">
      {overlay.segments.map((segment) => {
        const style: CSSProperties = {
          ...css(
            overlayRect(
              overlay,
              segment.from + 2,
              Math.max(0, segment.to - segment.from - 4),
              overlay.at,
              OVERLAY_LABEL_DEPTH,
            ),
          ),
          ...(horizontal ? {} : { writingMode: "vertical-rl" as const }),
        };
        if (onSelectElement && onRun)
          return (
            <EditableSegment
              key={segment.id}
              segment={segment}
              style={style}
              onSelect={() => segment.selects && onSelectElement(segment.selects)}
              onRun={onRun}
            />
          );
        return onSelectElement ? (
          <button
            key={segment.id}
            type="button"
            onClick={() => segment.selects && onSelectElement(segment.selects)}
            className={`${SEGMENT_CLASS} pointer-events-auto hover:text-foreground`}
            style={style}
            data-testid="kind-overlay-segment"
          >
            {segment.label}
          </button>
        ) : (
          <div
            key={segment.id}
            className={SEGMENT_CLASS}
            style={style}
            data-testid="kind-overlay-segment"
          >
            {segment.label}
          </div>
        );
      })}
      {overlay.separators.map((separator) => (
        <div
          key={separator.along}
          className="absolute border-dashed border-muted-foreground/40"
          style={{
            ...css(
              overlayRect(
                overlay,
                separator.along,
                0,
                separator.from,
                separator.to - separator.from,
              ),
            ),
            ...(horizontal ? { borderLeftWidth: 2 } : { borderTopWidth: 2 }),
          }}
          data-testid="kind-overlay-separator"
        />
      ))}
      {onRun &&
        overlay.separators.map(
          (separator) =>
            separator.moves &&
            separator.moves.length > 0 && (
              <DraggableSeparator
                key={`drag-${separator.along}`}
                overlay={overlay}
                separator={separator}
                onRun={onRun}
              />
            ),
        )}
      {(overlay.lines ?? []).map((line) => {
        const label =
          "absolute whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-primary/80";
        return (
          <div
            key={line.id}
            className={cn(
              "absolute border-dashed border-primary/60",
              horizontal ? "border-t-2" : "border-l-2",
            )}
            style={css(overlayRect(overlay, line.from, line.to - line.from, line.across, 0))}
            data-testid="kind-overlay-line"
          >
            {line.labels && (
              <>
                <span
                  className={label}
                  style={
                    horizontal
                      ? { left: 8, bottom: 4 }
                      : { top: 8, right: 4, writingMode: "vertical-rl" }
                  }
                >
                  {resolveKindText(line.labels.before)}
                </span>
                <span
                  className={label}
                  style={
                    horizontal
                      ? { left: 8, top: 4 }
                      : { top: 8, left: 4, writingMode: "vertical-rl" }
                  }
                >
                  {resolveKindText(line.labels.after)}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The active diagram's kind overlay on the editor canvas; `editable` lets the
 * author rename and move phases on the band (spec guided-direct-editing).
 */
export function KindOverlayLayer({
  onSelectElement,
  editable = false,
}: {
  onSelectElement: (id: string) => void;
  editable?: boolean;
}) {
  const overlay = useDiagramStore((state) =>
    kindOverlayFor(state.activeDiagramId ? state.diagrams[state.activeDiagramId] : null),
  );
  if (!overlay) return null;
  return (
    <ViewportPortal>
      <KindOverlayView
        overlay={overlay}
        onSelectElement={onSelectElement}
        {...(editable && { onRun: runKindOutcome })}
      />
    </ViewportPortal>
  );
}
