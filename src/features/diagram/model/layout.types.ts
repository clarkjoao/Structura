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
