import type { AwsCategoryId } from "@/lib/catalogs/aws";
import type { ExternalLinkType, PanelKind } from "../enums";

export type ComponentType =
  | "person"
  | "system"
  | "container"
  | "component"
  | "panel"
  | "note"
  | "api-group"
  | "endpoint"
  | "unknown"
  | "svg"
  | "db-table"
  | "json-viewer"
  | AwsCategoryId;

export interface ExternalLink {
  id: string;
  label: string;
  url: string;
  type: ExternalLinkType;
}

interface BaseComponent {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  /** Id of an entry in the diagram snapshot `iconLibrary`. */
  customIconId?: string;
  tags?: string[];
  serviceId?: string;
  linkedDiagramId?: string;
  /** When true, node is hidden on canvas (e.g. child of collapsed panel). Never clear parentId. */
  hidden?: boolean;
  /** Explicit ordering of connections by handle position. Incoming = left side, outgoing = right side. */
  handleOrder?: {
    incoming: string[];
    outgoing: string[];
  };
  /** Relative position in a user template capture (centroid-normalized); not used on live canvas. */
  x?: number;
  y?: number;
  /** Custom component template origin. Cleared when node data diverges from template. */
  templateId?: string;
  /** Optional custom-template registry reference used during instantiation. */
  registryServiceId?: string;
  externalLinks?: ExternalLink[];
}

export interface C4Component extends BaseComponent {
  type: "person" | "system" | "container" | "component";
  technology?: string;
  panelColor?: string;
}

export type { PanelKind };

/** Visual / semantic options for {@link PanelKind} `"swimlane"` (actor / domain lanes). */
export interface SwimlaneStyle {
  /** Default: horizontal */
  orientation?: "horizontal" | "vertical";
  laneColor?: string;
  laneLabel?: string;
}

export interface PanelComponent extends BaseComponent {
  type: "panel";
  panelKind?: PanelKind;
  panelColor?: string;
  panelOpacity?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  collapsed?: boolean;
  collapsedWidth?: number;
  collapsedHeight?: number;
  swimlane?: SwimlaneStyle;
}

export interface NoteComponent extends BaseComponent {
  type: "note";
  panelColor?: string;
  collapsed?: boolean;
  collapsedWidth?: number;
  collapsedHeight?: number;
}

export interface AwsComponent extends BaseComponent {
  type: AwsCategoryId;
  awsService?: string;
  technology?: string;
}

export interface EndpointHandler {
  id: string;
  label: string;
  flowId?: string;
  description?: string;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "EVENT";

export type ApiProtocol = "REST" | "gRPC" | "GraphQL" | "WebSocket";

export interface ApiGroupComponent extends BaseComponent {
  type: "api-group";
  serviceName: string;
  basePath: string;
  protocol: ApiProtocol;
  sla?: string;
}

export interface EndpointComponent extends BaseComponent {
  type: "endpoint";
  method: HttpMethod;
  path: string;
  /** Optional short description for the endpoint (base description is also used for general notes). */
  endpointDescription?: string;
  handlers: EndpointHandler[];
}

export interface UnknownComponent extends BaseComponent {
  type: "unknown";
  /** Raw content from the original source (ex: draw.io XML value attribute). */
  rawContent?: string;
}

export interface SvgComponent extends BaseComponent {
  type: "svg";
  /** Sanitized SVG markup rendered as the node body. */
  svgContent: string;
}

export interface DbColumn {
  id: string;
  name: string;
  dataType: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  /** id de outro DbTableComponent referenciado por esta FK */
  foreignTableId?: string;
  nullable?: boolean;
  unique?: boolean;
}

export interface DbTableComponent extends BaseComponent {
  type: "db-table";
  tableName: string;
  columns: DbColumn[];
  collapsed?: boolean;
  collapsedWidth?: number;
  collapsedHeight?: number;
}

export interface JsonViewerComponent extends BaseComponent {
  type: "json-viewer";
  /** JSON raw string — stored as string, validated in the UI node */
  jsonContent: string;
  /** Optional external schema reference (URL or name) */
  schemaRef?: string;
}

export type Component =
  | C4Component
  | PanelComponent
  | NoteComponent
  | AwsComponent
  | ApiGroupComponent
  | EndpointComponent
  | UnknownComponent
  | DbTableComponent
  | JsonViewerComponent
  | UnknownComponent
  | SvgComponent;

export type ComponentPatch = Partial<Omit<C4Component, "id">> &
  Partial<Omit<PanelComponent, "id">> &
  Partial<Omit<NoteComponent, "id">> &
  Partial<Omit<AwsComponent, "id">> &
  Partial<Omit<ApiGroupComponent, "id">> &
  Partial<Omit<EndpointComponent, "id">> &
  Partial<Omit<UnknownComponent, "id">> &
  Partial<Omit<DbTableComponent, "id">> &
  Partial<Omit<JsonViewerComponent, "id">> &
  Partial<Omit<SvgComponent, "id">> & { width?: number; height?: number };
