import type {
  Connection,
  ConnectionIntent,
  ConnectionDirection,
  ConnectionStyle,
  EdgeMarker,
} from "./connection.types";

/** Resolved connection style: intent defaults + direction markers + explicit overrides. */
export interface EffectiveConnectionStyle {
  strokeStyle: ConnectionStyle["strokeStyle"];
  strokeWidth: number;
  markerStart: EdgeMarker;
  markerEnd: EdgeMarker;
  animated: boolean;
}

const DEFAULT_STROKE_WIDTH = 1;
const DEFAULT_STROKE_STYLE = "solid" as const;
const DEFAULT_MARKER_END = "arrowclosed" as const;
const DEFAULT_MARKER_START = "none" as const;

/** Default visual style per intent. User-overridden style fields take precedence when rendering. */
export const INTENT_DEFAULTS: Record<ConnectionIntent, ConnectionStyle> = {
  dependency: {
    strokeStyle: "dashed",
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: "arrow",
    markerStart: DEFAULT_MARKER_START,
    animated: false,
  },
  call: {
    strokeStyle: DEFAULT_STROKE_STYLE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: DEFAULT_MARKER_END,
    markerStart: DEFAULT_MARKER_START,
    animated: false,
  },
  event: {
    strokeStyle: DEFAULT_STROKE_STYLE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: DEFAULT_MARKER_END,
    markerStart: DEFAULT_MARKER_START,
    animated: true,
  },
  "data-flow": {
    strokeStyle: DEFAULT_STROKE_STYLE,
    strokeWidth: 3,
    markerEnd: DEFAULT_MARKER_END,
    markerStart: DEFAULT_MARKER_START,
    animated: true,
  },
  "async-message": {
    strokeStyle: "dashed",
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: DEFAULT_MARKER_END,
    markerStart: DEFAULT_MARKER_START,
    animated: true,
  },
};

/** Marker mapping per direction. Applied when rendering; direction only affects markers. */
export const DIRECTION_MARKERS: Record<
  ConnectionDirection,
  { markerStart: EdgeMarker; markerEnd: EdgeMarker }
> = {
  unidirectional: { markerStart: "none", markerEnd: "arrowclosed" },
  bidirectional: { markerStart: "arrowclosed", markerEnd: "arrowclosed" },
  reverse: { markerStart: "arrowclosed", markerEnd: "none" },
};

/**
 * Resolve effective style for a connection.
 * Merges intent defaults, direction markers, and explicit style overrides.
 * Explicit `conn.style` fields take precedence over derived values.
 */
export function getEffectiveConnectionStyle(conn: Connection): EffectiveConnectionStyle {
  const intent = conn.intent ?? "call";
  const direction = conn.direction ?? "unidirectional";
  const fromIntent = INTENT_DEFAULTS[intent];
  const fromDirection = DIRECTION_MARKERS[direction];
  const s = conn.style;

  return {
    strokeStyle: s?.strokeStyle ?? fromIntent.strokeStyle ?? DEFAULT_STROKE_STYLE,
    strokeWidth: s?.strokeWidth ?? fromIntent.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    markerStart: s?.markerStart ?? fromDirection.markerStart,
    markerEnd: s?.markerEnd ?? fromDirection.markerEnd,
    animated: s?.animated ?? fromIntent.animated ?? false,
  };
}

/** Get default style for a given intent (e.g. when creating a new connection). */
export function getIntentDefault(intent: ConnectionIntent): ConnectionStyle {
  return { ...INTENT_DEFAULTS[intent] };
}
