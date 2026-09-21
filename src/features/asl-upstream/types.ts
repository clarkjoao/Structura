/**
 * Types for ASL Upstream feature.
 */

export interface UpstreamNamespace {
  id: string;
  name: string;
}

export interface DiagramUrlResponse {
  url: Record<string, string>;
}

export interface UpstreamDiagram {
  namespace: string;
  files: string[];
  urls?: Record<string, string>;
}
