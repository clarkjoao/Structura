import { StrokeStyle, EdgeMarker } from "../enums";
import type {
  Connection,
  ConnectionIntent,
  ConnectionDirection,
  ConnectionStyle,
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

/** Default visual style per intent. User-overridden style fields take precedence when rendering. */
export const INTENT_DEFAULTS: Record<ConnectionIntent, ConnectionStyle> = {
  dependency: {
    strokeStyle: StrokeStyle.Dashed,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: EdgeMarker.Arrow,
    markerStart: EdgeMarker.None,
    animated: false,
  },
  call: {
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: EdgeMarker.ArrowClosed,
    markerStart: EdgeMarker.None,
    animated: false,
  },
  event: {
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: EdgeMarker.ArrowClosed,
    markerStart: EdgeMarker.None,
    animated: true,
  },
  "data-flow": {
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: 3,
    markerEnd: EdgeMarker.ArrowClosed,
    markerStart: EdgeMarker.None,
    animated: true,
  },
  "async-message": {
    strokeStyle: StrokeStyle.Dashed,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: EdgeMarker.ArrowClosed,
    markerStart: EdgeMarker.None,
    animated: true,
  },
};

/** Marker mapping per direction. Applied when rendering; direction only affects markers. */
export const DIRECTION_MARKERS: Record<
  ConnectionDirection,
  { markerStart: EdgeMarker; markerEnd: EdgeMarker }
> = {
  unidirectional: { markerStart: EdgeMarker.None, markerEnd: EdgeMarker.ArrowClosed },
  bidirectional: { markerStart: EdgeMarker.ArrowClosed, markerEnd: EdgeMarker.ArrowClosed },
  reverse: { markerStart: EdgeMarker.ArrowClosed, markerEnd: EdgeMarker.None },
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
    strokeStyle: s?.strokeStyle ?? fromIntent.strokeStyle ?? StrokeStyle.Solid,
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
