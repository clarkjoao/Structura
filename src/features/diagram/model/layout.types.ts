export interface Point {
  x: number;
  y: number;
}

export interface EdgeLayout {
  waypoints: Point[];

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

export type ViewNodeLayout = NodeLayout;
