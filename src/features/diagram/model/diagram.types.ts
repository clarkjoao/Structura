export type {
  ComponentType,
  PluginComponentType,
  PluginTypedComponent,
  Component,
  ComponentPatch,
  TypedComponentPatch,
  C4Component,
  PanelComponent,
  SwimlaneStyle,
  NoteComponent,
  AwsComponent,
  ApiGroupComponent,
  ApiProtocol,
  EndpointComponent,
  UnknownComponent,
  SvgComponent,
  EndpointHandler,
  HttpMethod,
  PanelKind,
  ExternalLink,
  DbTableComponent,
  DbColumn,
  JsonViewerComponent,
  FlowNodeComponent,
  ProcessNodeComponent,
  FlowNodeShape,
  ExternalElementComponent,
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

export type {
  NodeLayout,
  ViewNodeLayout,
  Point,
  EdgeLayout,
  EdgeControlPoint,
  EdgePathType,
} from "./layout.types";

export type { FlowStep, FlowStepType, FlowBranch, Flow } from "./flow.types";

import type { Component } from "./component.types";
import type { Connection } from "./connection.types";
import type { Flow } from "./flow.types";
import type { EdgeLayout, NodeLayout } from "./layout.types";

export type Level = "context" | "container" | "component" | string;

export type IconSource =
  | { kind: "svg"; svgContent: string }
  | { kind: "lucide"; iconName: string }
  | { kind: "aws"; serviceName: string };

export interface IconDefinition {
  id: string;
  name: string;
  source: IconSource;

  createdAt: number;

  usageCount: number;
}

export const isSvgIcon = (
  icon: IconDefinition,
): icon is IconDefinition & { source: { kind: "svg"; svgContent: string } } =>
  icon.source.kind === "svg";

export const isLucideIcon = (
  icon: IconDefinition,
): icon is IconDefinition & { source: { kind: "lucide"; iconName: string } } =>
  icon.source.kind === "lucide";

export const isAwsIcon = (
  icon: IconDefinition,
): icon is IconDefinition & { source: { kind: "aws"; serviceName: string } } =>
  icon.source.kind === "aws";

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

export type UserTemplateComponent = Omit<Component, "id" | "parentId" | "x" | "y"> & {
  parentIndex?: number;

  _relX?: number;
  _relY?: number;

  width?: number;
  height?: number;
};

export interface UserTemplate {
  id: string;
  name: string;
  description?: string;

  category?: string;

  createdAt: number;
  components: UserTemplateComponent[];
  connections: Array<
    Omit<Connection, "id" | "sourceId" | "targetId"> & {
      sourceIndex: number;
      targetIndex: number;
    }
  >;
}

export interface SceneDiff {
  id: string;
  name: string;
  color: string;
  createdAt: number;
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
  description?: string;
  level: Level;
  domain?: string;
  createdAt: number;
  updatedAt: number;
  snapshot: ModelDraft;
  nodeLayouts: Record<string, NodeLayout>;
  edgeLayouts: Record<string, EdgeLayout>;
  viewport: { x: number; y: number; zoom: number };
  folderId?: string | null;
  scenes?: Record<string, SceneDiff>;
  activeSceneId?: string | null;

  compareSceneId?: string | null;
}

export type DiagramModel = Omit<Diagram, "viewport">;
