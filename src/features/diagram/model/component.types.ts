import type { AwsCategoryId } from "@/lib/catalogs/aws";

export type ComponentType =
  | "person"
  | "system"
  | "container"
  | "component"
  | "panel"
  | "note"
  | "api-group"
  | "endpoint"
  | AwsCategoryId;

interface BaseComponent {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
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
}

export interface C4Component extends BaseComponent {
  type: "person" | "system" | "container" | "component";
  technology?: string;
  panelColor?: string;
}

export type PanelKind =
  | "default"
  | "availability-zone"
  | "eks-cluster"
  | "ecs-cluster"
  | "auto-scaling-group"
  | "vpc"
  | "public-subnet"
  | "private-subnet"
  | "swimlane";

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

export type Component = C4Component | PanelComponent | NoteComponent | AwsComponent | ApiGroupComponent | EndpointComponent;

export type ComponentPatch = Partial<Omit<C4Component, "id">> &
  Partial<Omit<PanelComponent, "id">> &
  Partial<Omit<NoteComponent, "id">> &
  Partial<Omit<AwsComponent, "id">> &
  Partial<Omit<ApiGroupComponent, "id">> &
  Partial<Omit<EndpointComponent, "id">> & { width?: number; height?: number };
