import type { EdgeStyle, StrokeStyle, ConnectionStyle } from "@/features/diagram";

export interface EdgeData {
  label: string;
  technology?: string;
  color?: string;
  connectionId: string;
  recordingBadges?: number[];
  isLastRecorded?: boolean;
  coverageFlowNames?: string[];
  playbackDuration?: string;
  isActivePlayback?: boolean;
  activePayload?: string | null;
  activePayloadDirection?: "request" | "response" | null;
  edgeStyle?: EdgeStyle;
  strokeStyle?: StrokeStyle;
  strokeWidth?: number;
  labelPosition?: number;
  connectionStyle?: ConnectionStyle;
}
