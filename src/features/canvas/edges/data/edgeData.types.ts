import type { EdgeStyle, StrokeStyle, ConnectionStyle, EdgeControlPoint } from "@/features/diagram";

/**
 * Pure styling + identity data the editable-edge core needs to render and edit.
 * Kept free of flow/playback concerns so overlay updates don't churn the core.
 */
export type EdgeStyleData = {
  label: string;
  technology?: string;
  color?: string;
  connectionId: string;
  edgeStyle?: EdgeStyle;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  labelPosition?: number;
  connectionStyle?: ConnectionStyle;
  /**
   * Author / visualization waypoints stamped by the read projection.
   * When defined, EditableEdge prefers these over the store (viewer has no active diagram).
   * Omitted on the editor path so live store edits stay the single source of truth.
   */
  layoutPoints?: EdgeControlPoint[];
  /** Label offset from `diagram.edgeLayouts`, same stamp contract as `layoutPoints`. */
  layoutLabelOffset?: number;
};

/**
 * Non-editing overlays that ride on an edge (flow mode, playback, recording,
 * coverage). Rendered by isolated overlay components, not the editing core.
 */
export type EdgeOverlayData = {
  stepBadges?: string[];
  isLastRecorded?: boolean;
  coverageFlowNames?: string[];
  playbackDuration?: string;
  isActivePlayback?: boolean;
  activePayload?: string | null;
  activePayloadDirection?: "request" | "response" | null;
};

/**
 * The full `data` blob carried on a React Flow edge. Declared as a `type` (not
 * an interface) so it satisfies React Flow's `Record<string, unknown>` data
 * constraint, and with an index signature for the same reason.
 */
export type EdgeData = EdgeStyleData & EdgeOverlayData & { [key: string]: unknown };
