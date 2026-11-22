import { ViewportPortal } from "@xyflow/react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { kindOverlayFor } from "@/features/diagram-kinds/overlay";
import type { KindOverlay } from "@/features/diagram-kinds/kind.types";

const TONE: Record<KindOverlay["curve"][number]["tone"], string> = {
  danger: "rgb(239 68 68)",
  warning: "rgb(245 158 11)",
  success: "rgb(34 197 94)",
  neutral: "rgb(148 163 184)",
};

/** The label row's depth inside the band; the curve takes the rest. */
const LABEL_DEPTH = 28;

/**
 * The active kind's overlay on the canvas (spec guided-journey-phases): the
 * phase band, the separators across the lanes and the emotion curve. Drawn in
 * flow coordinates inside the viewport; it is not an element, so it cannot be
 * selected, moved or exported. Clicking a phase selects the step it starts at.
 */
export function KindOverlayLayer({ onSelectElement }: { onSelectElement: (id: string) => void }) {
  const overlay = useDiagramStore((state) =>
    kindOverlayFor(state.activeDiagramId ? state.diagrams[state.activeDiagramId] : null),
  );
  if (!overlay) return null;
  const horizontal = overlay.axis === "x";
  /** A rectangle given along/across extents, as absolute CSS in flow units. */
  const box = (along: number, alongSize: number, across: number, acrossSize: number) =>
    horizontal
      ? { left: along, top: across, width: alongSize, height: acrossSize }
      : { left: across, top: along, width: acrossSize, height: alongSize };

  const curveDepth = overlay.depth - LABEL_DEPTH;
  const alongMin = Math.min(
    ...overlay.segments.map((s) => s.from),
    ...overlay.curve.map((p) => p.along),
  );
  const alongMax = Math.max(
    ...overlay.segments.map((s) => s.to),
    ...overlay.curve.map((p) => p.along),
  );
  const point = (p: KindOverlay["curve"][number]) => {
    const a = p.along - alongMin;
    const c = LABEL_DEPTH + 6 + (1 - p.value) * (curveDepth - 12);
    return horizontal ? { x: a, y: c } : { x: c, y: a };
  };

  return (
    <ViewportPortal>
      <div className="pointer-events-none" data-testid="kind-overlay">
        {overlay.segments.map((segment) => (
          <button
            key={segment.id}
            type="button"
            onClick={() => segment.selects && onSelectElement(segment.selects)}
            className="pointer-events-auto absolute flex items-center justify-center truncate rounded-md border border-border bg-card/90 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm hover:text-foreground"
            style={{
              ...box(
                segment.from + 2,
                Math.max(0, segment.to - segment.from - 4),
                overlay.at,
                LABEL_DEPTH,
              ),
              ...(horizontal ? {} : { writingMode: "vertical-rl" as const }),
            }}
            data-testid="kind-overlay-segment"
          >
            {segment.label}
          </button>
        ))}
        {overlay.separators.map((separator) => (
          <div
            key={separator.along}
            className="absolute border-dashed border-muted-foreground/40"
            style={{
              ...box(separator.along, 0, separator.from, separator.to - separator.from),
              ...(horizontal ? { borderLeftWidth: 2 } : { borderTopWidth: 2 }),
            }}
            data-testid="kind-overlay-separator"
          />
        ))}
        {overlay.curve.length > 0 && (
          <svg
            className="absolute overflow-visible"
            style={box(alongMin, Math.max(1, alongMax - alongMin), overlay.at, overlay.depth)}
            data-testid="kind-overlay-curve"
          >
            <polyline
              points={overlay.curve.map((p) => `${point(p).x},${point(p).y}`).join(" ")}
              fill="none"
              stroke="hsl(var(--muted-foreground) / 0.6)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {overlay.curve.map((p) => (
              <circle key={p.id} cx={point(p).x} cy={point(p).y} r={5} fill={TONE[p.tone]} />
            ))}
          </svg>
        )}
      </div>
    </ViewportPortal>
  );
}
