export interface C4MetaInfo {
  fillColor: string;
  strokeColor: string;
  fontColor: string;
  /** Canonical (floor) box — guaranteed when the canvas didn't measure a size. */
  width: number;
  height: number;
  /**
   * Upper bound on the box when the measured size grows with description /
   * technology text. A node longer than `maxWidth` is clamped to keep the
   * diagram layout stable; the cell's text reflows via wrap inside.
   */
  maxWidth: number;
  /** Upper bound on the box height (per-line ~22px, capped at `maxHeight`). */
  maxHeight: number;
}

export interface StyleOption {
  [key: string]: string | number | boolean | undefined;
}

export interface AwsServiceInfo {
  icon: string;
  categoryId: string;
  color: string;
}

export interface GeometryInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}
