/**
 * Barrel: re-exports all domain types and defines aggregate types (Diagram, ModelDraft, Folder).
 * Types are split by responsibility: component, connection, layout, flow.
 */
export type {
  ComponentType,
  Component,
  ComponentPatch,
  C4Component,
  PanelComponent,
  NoteComponent,
  AwsComponent,
  EndpointComponent,
  EndpointHandler,
  HttpMethod,
  PanelKind,
} from "./component.types";

export type {
  Connection,
  ConnectionStyle,
  ConnectionIntent,
  ConnectionDirection,
  EdgeStyle,
  StrokeStyle,
  EdgeMarker,
} from "./connection.types";

export type { NodeLayout, ViewNodeLayout } from "./layout.types";

export type { FlowStep, Flow } from "./flow.types";

// ── Aggregate types ────────────────────────────────────────────────────────

import type { Component } from "./component.types";
import type { Connection } from "./connection.types";
import type { Flow } from "./flow.types";
import type { NodeLayout } from "./layout.types";

export type Level = "context" | "container" | "component" | string;

export interface ModelDraft {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  flows: Record<string, Flow>;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  domain?: string;
}

export interface Diagram {
  id: string;
  name: string;
  level: Level;
  domain?: string;
  createdAt: string;
  updatedAt: string;
  snapshot: ModelDraft;
  nodeLayouts: Record<string, NodeLayout>;
  viewport: { x: number; y: number; zoom: number };
  folderId?: string | null;
}
