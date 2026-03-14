import type { Connection, ConnectionIntent, ConnectionDirection, ConnectionStyle } from "./connection.types";

/** Default visual style per intent. User-overridden style fields take precedence when rendering. */
export const INTENT_DEFAULTS: Record<ConnectionIntent, Partial<ConnectionStyle>> = {
  dependency: {
    strokeStyle: "dashed",
    strokeWidth: 1,
    markerEnd: "arrow",
    markerStart: "none",
    animated: false,
  },
  call: {
    strokeStyle: "solid",
    strokeWidth: 1,
    markerEnd: "arrowclosed",
    markerStart: "none",
    animated: false,
  },
  event: {
    strokeStyle: "solid",
    strokeWidth: 1,
    markerEnd: "arrowclosed",
    markerStart: "none",
    animated: true,
  },
  "data-flow": {
    strokeStyle: "solid",
    strokeWidth: 3,
    markerEnd: "arrowclosed",
    markerStart: "none",
    animated: true,
  },
  "async-message": {
    strokeStyle: "dashed",
    strokeWidth: 1,
    markerEnd: "arrowclosed",
    markerStart: "none",
    animated: true,
  },
};

/** Marker mapping per direction. Applied when rendering; direction only affects markers. */
export const DIRECTION_MARKERS: Record<
  ConnectionDirection,
  { markerStart: "arrow" | "arrowclosed" | "none"; markerEnd: "arrow" | "arrowclosed" | "none" }
> = {
  unidirectional: { markerStart: "none", markerEnd: "arrowclosed" },
  bidirectional: { markerStart: "arrowclosed", markerEnd: "arrowclosed" },
  reverse: { markerStart: "arrowclosed", markerEnd: "none" },
};

/** Resolve effective style for a connection: intent defaults + direction markers + explicit overrides. */
export function getEffectiveConnectionStyle(conn: Connection): {
  strokeStyle: ConnectionStyle["strokeStyle"];
  strokeWidth: number;
  markerStart: "arrow" | "arrowclosed" | "none";
  markerEnd: "arrow" | "arrowclosed" | "none";
  animated: boolean;
} {
  const intent = conn.intent ?? "call";
  const direction = conn.direction ?? "unidirectional";
  const fromIntent = INTENT_DEFAULTS[intent];
  const fromDirection = DIRECTION_MARKERS[direction];
  const s = conn.style;

  return {
    strokeStyle: s?.strokeStyle ?? fromIntent.strokeStyle ?? "solid",
    strokeWidth: s?.strokeWidth ?? fromIntent.strokeWidth ?? 1,
    markerStart: s?.markerStart !== undefined ? s.markerStart : fromDirection.markerStart,
    markerEnd: s?.markerEnd !== undefined ? s.markerEnd : fromDirection.markerEnd,
    animated: s?.animated ?? fromIntent.animated ?? false,
  };
}
