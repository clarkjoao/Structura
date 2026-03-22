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
  SwimlaneStyle,
  NoteComponent,
  AwsComponent,
  ApiGroupComponent,
  ApiProtocol,
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

export type { FlowStep, FlowStepType, FlowBranch, Flow } from "./flow.types";

// ── Aggregate types ────────────────────────────────────────────────────────

import type { Component } from "./component.types";
import type { Connection } from "./connection.types";
import type { Flow } from "./flow.types";
import type { NodeLayout } from "./layout.types";

export type Level = "context" | "container" | "component" | string;

/** Custom SVG icon stored on the diagram (sanitized inline markup). */
export interface IconDefinition {
  id: string;
  name: string;
  /** Sanitized, full inline SVG markup. */
  svgContent: string;
  /** Unix timestamp (ms). */
  createdAt: number;
  /** Incremented when assigned to a component; decremented when cleared or component removed. */
  usageCount: number;
}

export interface ModelDraft {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  flows: Record<string, Flow>;
  iconLibrary: Record<string, IconDefinition>;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  domain?: string;
}

/** Declarative diff over the immutable base snapshot (cel / scene). */
export interface SceneDiff {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  addedComponents: Record<string, Component>;
  addedConnections: Record<string, Connection>;
  removedComponentIds: string[];
  removedConnectionIds: string[];
  viewport?: { x: number; y: number; zoom: number };
  nodeLayouts: Record<string, NodeLayout>;
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
  scenes?: Record<string, SceneDiff>;
  activeSceneId?: string | null;
  /** Second scene for overlay compare mode (requires activeSceneId). */
  compareSceneId?: string | null;
}
