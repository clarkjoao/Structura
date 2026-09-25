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
   * The edge leaves its source from the bottom instead of the right. Only a
   * node whose handle spec declares `verticalSides` honours it (the flowchart
   * shapes); anywhere else the edge keeps the right side. Absent means right —
   * the default is never written, so an edge nobody re-sided hashes as before.
   */
  sourceSide?: "bottom";
  /** The edge arrives at its target on the top instead of the left. Same rules as `sourceSide`. */
  targetSide?: "top";
}
