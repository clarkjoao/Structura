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
  GcpComponent,
  AzureComponent,
  K8sComponent,
  OssComponent,
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

export type { FlowStep, FlowStepType, FlowConditionKind, FlowBranch, Flow } from "./flow.types";

import type { Component } from "./component.types";
import type { Connection } from "./connection.types";
import type { Flow } from "./flow.types";
import type { EdgeLayout, NodeLayout } from "./layout.types";
import type { DiagramLayoutSettings } from "./layout-settings";

export type Level = "context" | "container" | "component" | string;

/**
 * The axis a diagram reads along (ADR-0013): left-to-right (`"LR"`, the default
 * and never stored) or top-to-bottom (`"TB"`). Handles, edges and layouts follow
 * it; the side an edge uses never comes from where its nodes sit.
 */
export type DiagramDirection = "LR" | "TB";

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

/** Where a Version is in its lifecycle, like a planned change on a roadmap. */
export type VersionStatus = "proposed" | "approved" | "in-progress" | "done";

export const VERSION_STATUSES: readonly VersionStatus[] = [
  "proposed",
  "approved",
  "in-progress",
  "done",
];

/**
 * A logical branch over the diagram's base: what it adds, replaces and hides. The fields after
 * `nodeLayouts` are optional so a Version that never uses them stores and hashes as before; read
 * them through the helpers in `version.utils.ts`.
 */
export interface VersionDiff {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  addedComponents: Record<string, Component>;
  addedConnections: Record<string, Connection>;
  removedComponentIds: string[];
  removedConnectionIds: string[];
  viewport?: { x: number; y: number; zoom: number };
  /** Layouts of added nodes, and overrides for base nodes moved inside the Version. */
  nodeLayouts: Record<string, NodeLayout>;
  /** Base components replaced whole inside the Version (copy-on-write), by id. */
  modifiedComponents?: Record<string, Component>;
  /** Base connections replaced whole inside the Version (copy-on-write), by id. */
  modifiedConnections?: Record<string, Connection>;
  /** Element id → hash of the base element when the Version copied it (`hashElement`). */
  baseHashes?: Record<string, string>;
  status?: VersionStatus;
  /** A stable id given from outside (e.g. an opscr initiative), shared across diagrams. */
  key?: string;
  /** The plugin that owns this Version: its merge, rename and delete go to that plugin. */
  ownerPluginId?: string;
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
  versions?: Record<string, VersionDiff>;
  activeVersionId?: string | null;

  compareVersionId?: string | null;

  /**
   * The text layer: `text` elements are drawn only while this is on. Absent
   * means off — the planning notes stay out of the viewer, shared links and
   * exports until the author turns it on and saves.
   */
  textsVisible?: boolean;
  /**
   * Whether the generated legend is drawn on the canvas. Absent means off, so an untouched
   * diagram hashes as before.
   */
  showLegend?: boolean;

  /**
   * How the auto-layout arranges this diagram (`layout-settings.ts`). Absent
   * means the default arrangement; written only through `applyAutoLayout`, so
   * a change and the arrangement it causes are one undo step.
   */
  layoutSettings?: DiagramLayoutSettings;

  /**
   * Top-to-bottom when `"TB"`; absent means left-to-right, so every diagram
   * from before ADR-0013 hashes and exports as it did. Written only by an
   * arrangement on the new axis (`applyAutoLayout`), so the switch and the
   * layout it needs are one undo step.
   */
  direction?: "TB";
}

export type DiagramModel = Omit<Diagram, "viewport">;
