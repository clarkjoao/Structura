import { ViewportPortal } from "@xyflow/react";
import type { CSSProperties } from "react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { kindOverlayFor } from "@/features/diagram-kinds/overlay";
import { resolveKindText } from "@/features/diagram-kinds/context";
import { cn } from "@/lib/utils";
import type { KindOverlay } from "@/features/diagram-kinds/kind.types";
import {
  OVERLAY_LABEL_DEPTH,
  overlayCurvePoints,
  overlayRect,
} from "@/features/diagram-kinds/overlay.geometry";

const TONE: Record<KindOverlay["curve"][number]["tone"], string> = {
  danger: "rgb(239 68 68)",
  warning: "rgb(245 158 11)",
  success: "rgb(34 197 94)",
  neutral: "rgb(148 163 184)",
};

const SEGMENT_CLASS =
  "absolute flex items-center justify-center truncate rounded-md border border-border bg-card/90 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm";

/** A rectangle as absolute CSS in flow units. */
function css(rect: { x: number; y: number; width: number; height: number }): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

/**
 * A kind overlay drawn inside the viewport (spec guided-journey-phases): the
 * phase band, the separators across the lanes and the emotion curve. It is not
 * an element, so it cannot be selected, moved or exported as a node. With
 * `onSelectElement`, clicking a phase selects the step it starts at; without
 * it (read-only surfaces) the segments are plain labels.
 */
export function KindOverlayView({
  overlay,
  onSelectElement,
}: {
  overlay: KindOverlay;
  onSelectElement?: (id: string) => void;
}) {
  const horizontal = overlay.axis === "x";
  const points = overlayCurvePoints(overlay);
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));

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
      {points.length > 0 && (
        <svg
          className="absolute overflow-visible"
          style={{
            left: minX,
            top: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
          }}
          data-testid="kind-overlay-curve"
        >
          <polyline
            points={points.map((p) => `${p.x - minX},${p.y - minY}`).join(" ")}
            fill="none"
            stroke="hsl(var(--muted-foreground) / 0.6)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {points.map((p) => (
            <circle key={p.id} cx={p.x - minX} cy={p.y - minY} r={5} fill={TONE[p.tone]} />
          ))}
        </svg>
      )}
    </div>
  );
}

/** The active diagram's kind overlay on the editor canvas. */
export function KindOverlayLayer({ onSelectElement }: { onSelectElement: (id: string) => void }) {
  const overlay = useDiagramStore((state) =>
    kindOverlayFor(state.activeDiagramId ? state.diagrams[state.activeDiagramId] : null),
  );
  if (!overlay) return null;
  return (
    <ViewportPortal>
      <KindOverlayView overlay={overlay} onSelectElement={onSelectElement} />
    </ViewportPortal>
  );
}
