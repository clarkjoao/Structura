export interface Point {
  x: number;
  y: number;
}

export interface EdgeLayout {
  connectionId: string;
  waypoints: Point[];
  /** Relative position along the knot polyline (0 = source, 1 = target). Default 0.5. */
  labelOffset?: number;
}

export interface NodeLayout {
  elementId: string;
  x: number;
  y: number;
  zIndex?: number;
  width?: number;
  height?: number;
}

/** Alias for NodeLayout (used in DiagramSnapshot). */
export type ViewNodeLayout = NodeLayout;
