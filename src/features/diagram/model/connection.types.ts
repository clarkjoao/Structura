export type EdgeStyle = "straight" | "bezier" | "step" | "smoothstep";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type EdgeMarker = "arrow" | "arrowclosed" | "none";

export interface WaypointPosition {
  x: number;
  y: number;
}

export type ConnectionIntent =
  | "dependency"
  | "call"
  | "event"
  | "data-flow"
  | "async-message";

export type ConnectionDirection =
  | "unidirectional"
  | "bidirectional"
  | "reverse";

export interface ConnectionStyle {
  edgeStyle?: EdgeStyle;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  markerEnd?: EdgeMarker;
  markerStart?: EdgeMarker;
  animated?: boolean;
  labelPosition?: number;
  waypoints?: WaypointPosition[];
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
}
