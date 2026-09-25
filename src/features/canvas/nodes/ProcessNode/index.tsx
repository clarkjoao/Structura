import { memo, type CSSProperties } from "react";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import type { FlowNodeShape } from "@/features/diagram";
import { useHandleHighlight } from "../../contexts/HandleHighlightContext";
import type { ProcessNodeData } from "./ProcessNode.types";
import {
  CYLINDER_CAP_RY,
  DOCUMENT_WAVE_RISE,
  EVENT_NOTCH,
  EVENT_TIP,
  FLOW_SHAPE_DEFAULT_SIZE,
  HEXAGON_CUT,
  IO_SLANT,
  PROCESS_RADIUS,
  ROUNDED_RADIUS,
  cylinderTopCap,
  flowShapeAccentPath,
  flowShapeHandles,
  flowShapePath,
  readFlowShape,
} from "./flowShapeGeometry";
import { BOTTOM_SOURCE_HANDLE_ID, TOP_TARGET_HANDLE_ID } from "../node-types/handle-spec";
import { flowPalette, resolveFlowAppearance, type FlowPalette } from "./flowAppearance";
import { useOnAccentColor } from "./useOnAccentColor";
import { FlowShapeIcon } from "./FlowShapeIcon";

const HANDLE_CLASS = "!w-2.5 !h-2.5 !border-2 !border-background !bg-muted-foreground";
const PRIMARY = "hsl(var(--primary))";

/** Shapes drawn as a card: a box with the accent as a 3px bar on the left, like C4. */
type CardShape = "rectangle" | "rounded" | "subroutine";

function isCardShape(shape: FlowNodeShape): shape is CardShape {
  return shape === "rectangle" || shape === "rounded" || shape === "subroutine";
}

interface ShapeProps {
  shape: FlowNodeShape;
  d: ProcessNodeData;
  palette: FlowPalette;
  isActive: boolean;
  w: number;
  h: number;
}

function Title({
  name,
  color,
  className = "text-sm",
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`min-w-0 select-none font-semibold leading-tight line-clamp-2 break-words ${className}`}
      style={{ color }}
    >
      {name}
    </span>
  );
}

function Description({ text, color }: { text?: string; color: string }) {
  if (!text) return null;
  return (
    <p className="mt-1 select-none text-xs leading-snug line-clamp-2 break-words" style={{ color }}>
      {text}
    </p>
  );
}

function Chip({ text, palette }: { text?: string; palette: FlowPalette }) {
  if (!text) return null;
  return (
    <span
      className="mt-1.5 inline-block max-w-full shrink-0 truncate rounded px-1.5 py-0.5 font-mono text-[11px] leading-tight"
      style={{ background: palette.chipBg, color: palette.chipText }}
    >
      {text}
    </span>
  );
}

function borderFor(palette: FlowPalette): CSSProperties {
  return {
    borderColor: palette.border,
    borderStyle: palette.borderStyle,
    borderWidth: palette.borderStyle === "dashed" ? 1.5 : 1,
  };
}

/** Process, alternative process and subprocess: the C4 card, with the flow shape's radius. */
function CardShapeBody({ shape, d, palette, isActive }: ShapeProps) {
  const isSubprocess = shape === "subroutine";
  return (
    <div
      className={`absolute inset-0 flex flex-col overflow-hidden px-3 py-2.5 shadow-sm ${
        isActive ? "ring-2 ring-primary" : ""
      }`}
      style={{
        ...borderFor(palette),
        borderLeft: `3px solid ${palette.accent}`,
        borderRadius: shape === "rounded" ? ROUNDED_RADIUS : PROCESS_RADIUS,
        background: palette.surface,
        paddingBottom: isSubprocess ? 28 : undefined,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <FlowShapeIcon shape={shape} color={palette.icon} />
        <Title name={d.name} color={palette.title} />
      </div>
      <Description text={d.description} color={palette.muted} />
      <Chip text={d.technology} palette={palette} />
      {isSubprocess && (
        <span
          className="absolute bottom-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded"
          style={{ border: `1.25px solid ${palette.muted}` }}
          aria-hidden
        >
          <Plus size={12} strokeWidth={1.75} color={palette.muted} />
        </span>
      )}
    </div>
  );
}

/** Terminal: a pill with the accent carried by a round badge on the left. */
function TerminalBody({ shape, d, palette, isActive, h }: ShapeProps) {
  const badge = Math.max(16, Math.min(34, h - 12));
  return (
    <div
      className={`absolute inset-0 flex items-center gap-2.5 overflow-hidden rounded-full pl-2 pr-4 shadow-sm ${
        isActive ? "ring-2 ring-primary" : ""
      }`}
      style={{ ...borderFor(palette), background: palette.surface }}
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: badge, height: badge, background: palette.tint }}
      >
        <FlowShapeIcon shape={shape} color={palette.icon} />
      </span>
      <div className="flex min-w-0 flex-col">
        <Title name={d.name} color={palette.title} />
        {d.description && (
          <span className="select-none truncate text-xs" style={{ color: palette.muted }}>
            {d.description}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Start and end: a small circle whose outline is the whole message, as in
 * BPMN — 2px for a start, 4px for an end — with a play or a stop glyph inside.
 * The name is a caption under the circle, which is too small to hold it.
 */
function StartEndBody({ shape, d, palette, isActive, w, h }: ShapeProps) {
  const isEnd = shape === "end";
  const strokeWidth = isEnd ? 4 : 2;
  const r = Math.max(1, Math.min(w, h) / 2 - strokeWidth / 2);
  const glyph = Math.max(8, Math.min(w, h) * 0.32);
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full overflow-visible drop-shadow-sm"
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden
      >
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2 - strokeWidth / 2}
          ry={h / 2 - strokeWidth / 2}
          fill={palette.solid ? palette.accent : palette.tint}
          stroke={palette.accentOutline}
          strokeWidth={strokeWidth}
          strokeDasharray={palette.dashArray}
        />
        {isEnd ? (
          <rect
            x={w / 2 - glyph / 2}
            y={h / 2 - glyph / 2}
            width={glyph}
            height={glyph}
            rx={2}
            fill={palette.icon}
          />
        ) : (
          <path
            d={`M${w / 2 - glyph * 0.35} ${h / 2 - glyph / 2} L${w / 2 + glyph * 0.5} ${h / 2} L${
              w / 2 - glyph * 0.35
            } ${h / 2 + glyph / 2} Z`}
            fill={palette.icon}
            strokeLinejoin="round"
          />
        )}
        {isActive && (
          <circle
            cx={w / 2}
            cy={h / 2}
            r={r + strokeWidth / 2 + 2}
            fill="none"
            stroke={PRIMARY}
            strokeWidth={2}
          />
        )}
      </svg>
      <span
        className="pointer-events-none absolute left-1/2 top-full mt-1.5 max-w-[160px] -translate-x-1/2 select-none truncate text-center text-xs font-semibold"
        style={{ color: "hsl(var(--foreground))" }}
      >
        {d.name}
      </span>
    </>
  );
}

/** How an SVG-drawn shape paints its body and outline. */
function svgPaint(shape: FlowNodeShape, palette: FlowPalette, solid: boolean) {
  // The decision is outlined in the accent, over a tint; the rest keep the
  // neutral outline and carry the accent on one edge.
  if (shape === "diamond") {
    return {
      fill: solid ? palette.accent : palette.tint,
      stroke: palette.accentOutline,
      strokeWidth: 1.5,
    };
  }
  return { fill: palette.surface, stroke: palette.border, strokeWidth: 1.5 };
}

/** Where the label sits inside an SVG shape, so it stays within the silhouette. */
function contentInset(shape: FlowNodeShape, w: number): CSSProperties {
  switch (shape) {
    case "diamond":
      return { left: "20%", right: "20%", top: "18%", bottom: "18%" };
    case "hexagon": {
      const cut = Math.min(HEXAGON_CUT, w / 4);
      return { left: cut + 8, right: cut + 8, top: 6, bottom: 6 };
    }
    case "parallelogram": {
      const slant = Math.min(IO_SLANT, w / 4);
      return { left: slant + 10, right: slant + 10, top: 6, bottom: 6 };
    }
    case "cylinder":
      return { left: 10, right: 10, top: CYLINDER_CAP_RY * 2 + 4, bottom: 8 };
    case "event":
      return { left: EVENT_NOTCH + 8, right: EVENT_TIP + 6, top: 6, bottom: 6 };
    case "document":
      return { left: 12, right: 10, top: 8, bottom: DOCUMENT_WAVE_RISE + 2 };
    default:
      return { left: 10, right: 10, top: 6, bottom: 6 };
  }
}

/** Decision, preparation, input/output, data store: drawn from the geometry. */
function SvgShapeBody({ shape, d, palette, isActive, w, h }: ShapeProps) {
  const { solid } = palette;
  const outline = flowShapePath(shape, w, h);
  const accentEdge = flowShapeAccentPath(shape, w, h);
  const paint = svgPaint(shape, palette, solid);
  const cap = shape === "cylinder" ? cylinderTopCap(w, h) : null;
  const centred = shape === "diamond" || shape === "cylinder";

  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full overflow-visible drop-shadow-sm"
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden
      >
        <path
          d={outline}
          fill={solid ? palette.accent : paint.fill}
          stroke={paint.stroke}
          strokeWidth={paint.strokeWidth}
          strokeDasharray={palette.dashArray}
          strokeLinejoin="round"
        />
        {accentEdge && (
          <path
            d={accentEdge}
            fill="none"
            stroke={palette.accent}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {cap && (
          <ellipse
            cx={cap.cx}
            cy={cap.cy}
            rx={cap.rx}
            ry={cap.ry}
            fill={palette.tint}
            stroke={solid ? palette.icon : palette.accent}
            strokeWidth={1.5}
            strokeDasharray={palette.dashArray}
          />
        )}
        {isActive && (
          <path d={outline} fill="none" stroke={PRIMARY} strokeWidth={2.5} strokeLinejoin="round" />
        )}
      </svg>
      <div
        className={`pointer-events-none absolute flex overflow-hidden ${
          centred ? "flex-col items-center justify-center text-center" : "flex-col justify-center"
        }`}
        style={contentInset(shape, w)}
      >
        {shape === "diamond" ? (
          <>
            <FlowShapeIcon shape={shape} color={palette.icon} size={14} />
            <Title name={d.name} color={palette.title} className="mt-0.5 text-[13px]" />
          </>
        ) : centred ? (
          <>
            <Title name={d.name} color={palette.title} />
            <Chip text={d.technology} palette={palette} />
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <FlowShapeIcon shape={shape} color={palette.icon} />
              <Title name={d.name} color={palette.title} />
            </div>
            <Description text={d.description} color={palette.muted} />
          </>
        )}
      </div>
    </>
  );
}

/**
 * One handle in the middle of each side, on the shape's own outline. Left and
 * right are the plain input and output every edge uses by default; top is an
 * extra input and bottom an extra output, used by the edges drawn to or from
 * them (see `FLOW_SHAPE_HANDLES`).
 *
 * Positions are percentages of the box so they stay on the outline while the
 * node is being resized, before the next measurement.
 */
function FlowHandles({ shape, w, h }: { shape: FlowNodeShape; w: number; h: number }) {
  const at = flowShapeHandles(shape, w, h);
  const pct = (p: { x: number; y: number }): CSSProperties => ({
    left: `${(p.x / w) * 100}%`,
    top: `${(p.y / h) * 100}%`,
  });
  return (
    <>
      <Handle
        id="target-0"
        type="target"
        position={Position.Left}
        style={pct(at.left)}
        className={HANDLE_CLASS}
      />
      <Handle
        id={TOP_TARGET_HANDLE_ID}
        type="target"
        position={Position.Top}
        style={pct(at.top)}
        className={HANDLE_CLASS}
      />
      <Handle
        id="source-0"
        type="source"
        position={Position.Right}
        style={pct(at.right)}
        className={HANDLE_CLASS}
      />
      <Handle
        id={BOTTOM_SOURCE_HANDLE_ID}
        type="source"
        position={Position.Bottom}
        style={pct(at.bottom)}
        className={HANDLE_CLASS}
      />
    </>
  );
}

const ProcessNode = memo(
  ({ data: d, selected, width, height }: NodeProps<Node<ProcessNodeData>>) => {
    const { highlightedNodeIds } = useHandleHighlight();
    const isSelected = selected || d.isSelected;
    const isHighlighted = highlightedNodeIds.has(d.elementId);
    const isActive = !!(isSelected || isHighlighted);

    const shape = readFlowShape(d.flowShape);
    // Measured by React Flow; the declared default covers the first frame.
    const fallback = FLOW_SHAPE_DEFAULT_SIZE[d.flowShape];
    const w = width || fallback.width;
    const h = height || fallback.height;

    const appearance = resolveFlowAppearance(d);
    const onAccent = useOnAccentColor(appearance.accent, appearance.fill === "solid");
    const palette = flowPalette(appearance, onAccent);
    const shapeProps: ShapeProps = { shape, d, palette, isActive, w, h };

    return (
      <>
        <NodeResizer
          minWidth={60}
          minHeight={40}
          isVisible={isSelected}
          keepAspectRatio={shape === "start" || shape === "end"}
          lineClassName="!border-transparent"
          handleClassName="!w-2 !h-2 !bg-foreground/40 !border-background !rounded-sm"
        />
        <FlowHandles shape={shape} w={w} h={h} />
        <div className="relative h-full w-full" data-flow-shape={shape}>
          {isCardShape(shape) ? (
            <CardShapeBody {...shapeProps} />
          ) : shape === "start" || shape === "end" ? (
            <StartEndBody {...shapeProps} />
          ) : shape === "stadium" ? (
            <TerminalBody {...shapeProps} />
          ) : (
            <SvgShapeBody {...shapeProps} />
          )}
        </div>
      </>
    );
  },
);

ProcessNode.displayName = "ProcessNode";

export default ProcessNode;
