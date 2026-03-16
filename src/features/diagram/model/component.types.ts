import type { AwsCategoryId } from "@/lib/catalogs/aws";

export type ComponentType =
  | "person"
  | "system"
  | "container"
  | "component"
  | "panel"
  | "note"
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
  | "api-group"
  | "availability-zone"
  | "eks-cluster"
  | "ecs-cluster"
  | "auto-scaling-group"
  | "vpc"
  | "public-subnet"
  | "private-subnet";

export interface PanelComponent extends BaseComponent {
  type: "panel";
  panelKind?: PanelKind;
  panelColor?: string;
  panelOpacity?: number;
  collapsed?: boolean;
  collapsedWidth?: number;
  collapsedHeight?: number;
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

export interface EndpointComponent extends BaseComponent {
  type: "endpoint";
  method: HttpMethod;
  path: string;
  /** Optional short description for the endpoint (base description is also used for general notes). */
  endpointDescription?: string;
  handlers: EndpointHandler[];
}

export type Component = C4Component | PanelComponent | NoteComponent | AwsComponent | EndpointComponent;

export type ComponentPatch = Partial<Omit<C4Component, "id">> &
  Partial<Omit<PanelComponent, "id">> &
  Partial<Omit<NoteComponent, "id">> &
  Partial<Omit<AwsComponent, "id">> &
  Partial<Omit<EndpointComponent, "id">> & { width?: number; height?: number };
