export interface Point {
  x: number;
  y: number;
}

/** A single user-editable control point on an editable edge. `id` is stable across edits. */
export interface EdgeControlPoint {
  id: string;
  x: number;
  y: number;
}

/** How the path is drawn through an editable edge's control points. */
export type EdgePathType = "catmull-rom" | "linear";

export interface EdgeLayout {
  /** Ordered control points the editable path passes through. Absent = direct source→target. */
  points?: EdgeControlPoint[];
  /** Path algorithm for the control points; defaults to catmull-rom when omitted. */
  pathType?: EdgePathType;
  /** Normalized (0..1) position of the label along the path. */
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
