/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host export core (src/lib/export-core), synced via
 * `npm run sync-shared`. It is the single source of truth for draw.io
 * generation shared by the app and this plugin; edit the host files and re-sync.
 */

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
