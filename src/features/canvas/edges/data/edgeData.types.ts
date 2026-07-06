import type { EdgeStyle, StrokeStyle, ConnectionStyle } from "@/features/diagram";

/**
 * Pure styling + identity data the editable-edge core needs to render and edit.
 * Kept free of flow/playback concerns so overlay updates don't churn the core.
 */
export interface EdgeStyleData {
  label: string;
  technology?: string;
  color?: string;
  connectionId: string;
  edgeStyle?: EdgeStyle;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  labelPosition?: number;
  connectionStyle?: ConnectionStyle;
}

/**
 * Non-editing overlays that ride on an edge (flow mode, playback, recording,
 * coverage). Rendered by isolated overlay components, not the editing core.
 */
export interface EdgeOverlayData {
  recordingBadges?: number[];
  isLastRecorded?: boolean;
  coverageFlowNames?: string[];
  playbackDuration?: string;
  isActivePlayback?: boolean;
  activePayload?: string | null;
  activePayloadDirection?: "request" | "response" | null;
}

/** The full `data` blob carried on a React Flow edge. */
export interface EdgeData extends EdgeStyleData, EdgeOverlayData {}
