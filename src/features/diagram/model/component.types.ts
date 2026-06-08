import type { AwsCategoryId } from "@/lib/catalogs/aws";
import type { GcpCategoryId } from "@/features/cloud/providers/gcp/gcp.catalog";
import type { AzureCategoryId } from "@/features/cloud/providers/azure/azure.catalog";
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
  | "processos"
  | "external-element"
  | AwsCategoryId
  | GcpCategoryId
  | AzureCategoryId;

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
  
  locked?: boolean;
  
  customIconId?: string;
  tags?: string[];
  serviceId?: string;
  linkedDiagramId?: string;
  
  hidden?: boolean;
  
  handleOrder?: {
    incoming: string[];
    outgoing: string[];
  };
  
  x?: number;
  y?: number;
  
  templateId?: string;
  
  registryServiceId?: string;
  externalLinks?: ExternalLink[];
}

export interface C4Component extends BaseComponent {
  type: "person" | "system" | "container" | "component";
  technology?: string;
  panelColor?: string;
}

export type { PanelKind };


export interface SwimlaneStyle {
  
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
  panelColor?: string; // light-mode color (raw HSL or undefined)
  panelColorDark?: string; // dark-mode color (raw HSL or undefined)
  collapsed?: boolean;
  collapsedWidth?: number;
  collapsedHeight?: number;
}

export interface AwsComponent extends BaseComponent {
  type: AwsCategoryId;
  awsService?: string;
  technology?: string;
}

export interface GcpComponent extends BaseComponent {
  type: GcpCategoryId;
  gcpService?: string;
  technology?: string;
}

export interface AzureComponent extends BaseComponent {
  type: AzureCategoryId;
  azureService?: string;
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
  
  endpointDescription?: string;
  handlers: EndpointHandler[];
}

export interface UnknownComponent extends BaseComponent {
  type: "unknown";
  
  rawContent?: string;
}

export interface SvgComponent extends BaseComponent {
  type: "svg";
  
  svgContent: string;
}

export interface DbColumn {
  id: string;
  name: string;
  dataType: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  
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
  
  jsonContent: string;
  
  schemaRef?: string;
}

export type FlowNodeShape =
  | "rectangle"     // Mermaid: [text]
  | "rounded"       // Mermaid: (text)
  | "stadium"       // Mermaid: ([text])
  | "diamond"       // Mermaid: {text}
  | "hexagon"       // Mermaid: {{text}}
  | "parallelogram" // Mermaid: [/text/]
  | "cylinder"      // Mermaid: [(text)]
  | "circle"        // Mermaid: ((text))
  | "subroutine";   // Mermaid: [[text]]

export interface FlowNodeComponent extends BaseComponent {
  type: "processos";
  flowShape: FlowNodeShape;
  nodeColor?: string;
}

export interface ExternalElementComponent extends BaseComponent {
  type: "external-element";
  linkedDiagramId: string;
  linkedElementId?: string;
  linkedElementName?: string;
  linkedDiagramName?: string;
}

export type Component =
  | C4Component
  | PanelComponent
  | NoteComponent
  | AwsComponent
  | GcpComponent
  | AzureComponent
  | ApiGroupComponent
  | EndpointComponent
  | UnknownComponent
  | DbTableComponent
  | JsonViewerComponent
  | SvgComponent
  | FlowNodeComponent
  | ExternalElementComponent;


export type ComponentPatch = Partial<Omit<C4Component, "id">> &
  Partial<Omit<PanelComponent, "id">> &
  Partial<Omit<NoteComponent, "id">> &
  Partial<Omit<AwsComponent, "id">> &
  Partial<Omit<ApiGroupComponent, "id">> &
  Partial<Omit<EndpointComponent, "id">> &
  Partial<Omit<UnknownComponent, "id">> &
  Partial<Omit<DbTableComponent, "id">> &
  Partial<Omit<JsonViewerComponent, "id">> &
  Partial<Omit<SvgComponent, "id">> &
  Partial<Omit<FlowNodeComponent, "id">> &
  Partial<Omit<ExternalElementComponent, "id">> & { width?: number; height?: number };


export type TypedComponentPatch =
  | (Partial<Omit<C4Component, "id">> & { width?: number; height?: number })
  | (Partial<Omit<PanelComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<NoteComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<AwsComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ApiGroupComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<EndpointComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<UnknownComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<DbTableComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<JsonViewerComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<SvgComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<FlowNodeComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ExternalElementComponent, "id">> & { width?: number; height?: number })
  | { width?: number; height?: number };
