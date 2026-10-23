import type { EdgeStyle, StrokeStyle, EdgeMarker } from "../enums";

export type { EdgeStyle, StrokeStyle, EdgeMarker };

export type ConnectionIntent = "dependency" | "call" | "event" | "data-flow" | "async-message";

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
  intent?: ConnectionIntent;
  direction?: ConnectionDirection;
  communicationType?: "standard" | "custom";
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
