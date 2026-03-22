export interface Point {
  x: number;
  y: number;
}

export interface EdgeLayout {
  connectionId: string;
  waypoints: Point[];
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
