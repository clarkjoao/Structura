import type { EdgeStyle, StrokeStyle, EdgeMarker } from "../enums";

export type { EdgeStyle, StrokeStyle, EdgeMarker };

/**
 * The pre-v16 connection vocabulary: one value that carried the dash, the width and the animation.
 * Superseded by `ConnectionInteraction` × `ConnectionKind`; still read as a fallback for data that
 * has not been through the migration (an old shared link, a peer on an older build), and still the
 * type of `FlowStep.connectionIntent`.
 */
export type ConnectionIntent = "dependency" | "call" | "event" | "data-flow" | "async-message";

/** How the two ends talk: it drives the stroke — solid for sync, dashed for async. */
export type ConnectionInteraction = "sync" | "async";

/** What the connection is, whatever its interaction. */
export type ConnectionKind = "call" | "event" | "command" | "dependency";

/**
 * `"reverse"` is the pre-v16 value: an arrowhead at the source. It is migrated to a swapped
 * connection and no longer offered; it stays in the union only so unmigrated data still types.
 */
export type ConnectionDirection = "unidirectional" | "bidirectional" | "reverse";

export interface ConnectionStyle {
  edgeStyle?: EdgeStyle;
  color?: string;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  markerEnd?: EdgeMarker;
  markerStart?: EdgeMarker;
  animated?: boolean;
  labelPosition?: number;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  technology?: string;
  description?: string;
  /** Synchronous or asynchronous; drives the stroke. Absent reads as synchronous. */
  interaction?: ConnectionInteraction;
  kind?: ConnectionKind;
  direction?: ConnectionDirection;
  /** @deprecated Pre-v16; migrated into `interaction` and `kind`. */
  intent?: ConnectionIntent;
  /** @deprecated Pre-v16, never read by anything; dropped by the migration. */
  communicationType?: "standard" | "custom";
  /** @deprecated Pre-v16; migrated into `interaction` and `technology`. */
  transportPreset?: "sync" | "async" | "event" | "tcp" | "udp";
  style?: ConnectionStyle;
  /**
   * The edge leaves its source from the cross axis instead of the main output:
   * the bottom in a left-to-right diagram, the right in a top-to-bottom one
   * (ADR-0013). Sides are absolute, so a stored `"bottom"` in a top-to-bottom
   * diagram is just the main output. Only a node whose handle spec declares
   * `verticalSides` honours a cross side; anywhere else the edge keeps the main
   * output. Absent means the main output — the default is never written, so an
   * edge nobody re-sided hashes as before.
   */
  sourceSide?: "bottom" | "right";
  /** The edge arrives on the cross axis: the top (LR) or the left (TB). Same rules as `sourceSide`. */
  targetSide?: "top" | "left";
}
