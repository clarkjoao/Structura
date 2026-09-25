import type { AwsCategoryId } from "@/features/cloud/providers/aws/aws.catalog";
import type { GcpCategoryId } from "@/features/cloud/providers/gcp/gcp.catalog";
import type { AzureCategoryId } from "@/features/cloud/providers/azure/azure.catalog";
import type { K8sCategoryId } from "@/features/elements/families/k8s/k8s.catalog";
import type { OssCategoryId } from "@/features/elements/families/oss/oss.catalog";
import type { ExternalLinkType, PanelKind } from "../enums";

/**
 * Namespaced plugin component type: "<pluginId>/<name>". No built-in type contains "/",
 * which keeps the union discriminable; components with a plugin type degrade to the
 * `unknown` descriptor when the plugin is absent (plugin-system spec).
 */
export type PluginComponentType = `${string}/${string}`;

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
  | "process-node"
  | "external-element"
  | VsmComponentType
  | AwsCategoryId
  | GcpCategoryId
  | AzureCategoryId
  | K8sCategoryId
  | OssCategoryId
  | PluginComponentType;

/**
 * Brand for category ids that exist only via `registerCloudFamily` (not yet
 * on the closed `ComponentType` union). Cast at the family definition site —
 * never grow `ComponentType` per *future* family. k8s/oss shipped without a
 * typed component and are listed above so `cloudServiceId` is reachable
 * without `as Component`.
 */
export type OpenCatalogCategoryId = string & {
  readonly __openCatalogCategory: "open";
};

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
  /** Background tint 0–100 (Structura canvas semantics). Mirrors PanelComponent.panelOpacity. */
  opacity?: number;
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
  /** Cloud provider service id (lambda, rds, …). Unified in F6b; was awsService. */
  cloudServiceId?: string;
  technology?: string;
  customColor?: string;
}

export interface GcpComponent extends BaseComponent {
  type: GcpCategoryId;
  /** Cloud provider service id. Unified in F6b; was gcpService. */
  cloudServiceId?: string;
  technology?: string;
  customColor?: string;
}

export interface AzureComponent extends BaseComponent {
  type: AzureCategoryId;
  /** Cloud provider service id. Unified in F6b; was azureService. */
  cloudServiceId?: string;
  technology?: string;
  customColor?: string;
}

export interface K8sComponent extends BaseComponent {
  type: K8sCategoryId;
  /** Cloud / platform service id (deployment, ingress, …). */
  cloudServiceId?: string;
  technology?: string;
  customColor?: string;
}

export interface OssComponent extends BaseComponent {
  type: OssCategoryId;
  /** Cloud / platform service id (redis, kafka, …). */
  cloudServiceId?: string;
  technology?: string;
  customColor?: string;
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
  /** When false, render artwork only (no card chrome). Default true. */
  showBorder?: boolean;
  /** Accent color (left border / frame), same contract as cloud cards. */
  customColor?: string;
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
  | "rectangle" // Mermaid: [text]
  | "rounded" // Mermaid: (text)
  | "stadium" // Mermaid: ([text])
  | "diamond" // Mermaid: {text}
  | "hexagon" // Mermaid: {{text}}
  | "parallelogram" // Mermaid: [/text/]
  | "cylinder" // Mermaid: [(text)]
  | "circle" // Mermaid: ((text)) — legacy "start / end", read as `start`
  | "subroutine" // Mermaid: [[text]]
  | "start"
  | "end"
  | "document"
  | "event"
  | "junction-and"
  | "junction-or"
  | "annotation"
  | "evidence";

/** How a shape's accent colours its body. Absent means `"none"`. */
export type NodeFillMode = "none" | "soft" | "solid";

/** A shape's outline. Absent means `"solid"`. */
export type NodeStrokeMode = "solid" | "dashed";

export interface ProcessNodeComponent extends BaseComponent {
  type: "process-node";
  flowShape: FlowNodeShape;
  /**
   * Legacy fill colour. Nothing in the UI writes it any more — the accent is
   * `customColor`, the same field and toolbar control as the cloud cards — but
   * saved diagrams and presets can still carry it, so it is read as an accent
   * painted solid when the node has no accent of its own.
   */
  nodeColor?: string;
  /**
   * Accent: the bar, outline, icon and markers. Same field the toolbar colour
   * picker already writes on every card that has no dedicated colour; absent
   * means the family default (slate), resolved at render and never stored.
   */
  customColor?: string;
  /** Shown as the mono chip under the title (a data store's engine, say). */
  technology?: string;
  /** How the accent fills the body. Absent means `"none"`; the default is never written. */
  fill?: NodeFillMode;
  /** The outline. Absent means `"solid"`; the default is never written. */
  stroke?: NodeStrokeMode;
}

/** The three colour parts, for elements that wear the flow skin (flow, VSM). */
export interface SkinParts {
  /** Accent; absent means the element's default, resolved at render. */
  customColor?: string;
  /** Absent means `"none"`. */
  fill?: NodeFillMode;
  /** Absent means `"solid"`. */
  stroke?: NodeStrokeMode;
}

/** The Value Stream Mapping vocabulary (the `vsm` family). */
export type VsmComponentType =
  | "vsm-external"
  | "vsm-process"
  | "vsm-inventory"
  | "vsm-supermarket"
  | "vsm-push"
  | "vsm-kaizen"
  | "vsm-timeline";

/** Which side of the stream an outside source sits on. Absent means supplier. */
export type VsmRole = "supplier" | "customer";

/** A supplier or a customer: the factory icon at either end of the stream. */
export interface VsmExternalComponent extends BaseComponent, SkinParts {
  type: "vsm-external";
  role?: VsmRole;
}

/** One row of a VSM process's data box: a metric and its value, both as typed. */
export interface VsmMetric {
  id: string;
  key: string;
  value: string;
}

/** A process box: a step of the stream with its operators and its data box. */
export interface VsmProcessComponent extends BaseComponent, SkinParts {
  type: "vsm-process";
  /** People working the step; absent shows no count. */
  operators?: number;
  /** The data box rows, in order. */
  metrics?: VsmMetric[];
}

/** Inventory between two steps: the triangle with an I, and how much waits there. */
export interface VsmInventoryComponent extends BaseComponent, SkinParts {
  type: "vsm-inventory";
  /** As the user writes it: "1,200 pcs". */
  quantity?: string;
  /** How long it covers, as the user writes it: "2 days". */
  duration?: string;
}

/** A supermarket: a controlled store of parts the downstream step pulls from. */
export interface VsmSupermarketComponent extends BaseComponent, SkinParts {
  type: "vsm-supermarket";
}

/** A push arrow: material pushed downstream whether it is needed or not. */
export interface VsmPushComponent extends BaseComponent, SkinParts {
  type: "vsm-push";
}

/** A kaizen burst: an improvement to make, its text being the node's name. */
export interface VsmKaizenComponent extends BaseComponent, SkinParts {
  type: "vsm-kaizen";
}

/** One step of a VSM timeline: how long work waits, then how long it is worked on. */
export interface VsmTimelineSegment {
  id: string;
  wait: number;
  process: number;
}

/** The unit every value on one timeline is in, so its totals can be summed. */
export type VsmTimeUnit = "s" | "min" | "h" | "d";

/**
 * The timeline under a value stream: a square wave of waits and processing
 * times. Its totals — lead time and value-added time — are computed from the
 * segments, never stored.
 */
export interface VsmTimelineComponent extends BaseComponent, SkinParts {
  type: "vsm-timeline";
  segments?: VsmTimelineSegment[];
  /** Absent means minutes. */
  unit?: VsmTimeUnit;
}

export interface ExternalElementComponent extends BaseComponent {
  type: "external-element";
  /** Diagram this external element represents. Distinct from
   * `BaseComponent.linkedDiagramId`, which carries C4 drill-down
   * semantics (this component has a child diagram). */
  referenceDiagramId: string;
  linkedElementId?: string;
  linkedElementName?: string;
  linkedDiagramName?: string;
  customColor?: string;
}

export interface PluginTypedComponent extends BaseComponent {
  type: PluginComponentType;

  /** Opaque plugin-owned data; preserved verbatim while the owning plugin is absent. */
  pluginData?: Record<string, unknown>;
}

export type Component =
  | VsmTimelineComponent
  | VsmKaizenComponent
  | VsmPushComponent
  | VsmSupermarketComponent
  | VsmInventoryComponent
  | VsmProcessComponent
  | VsmExternalComponent
  | C4Component
  | PanelComponent
  | NoteComponent
  | AwsComponent
  | GcpComponent
  | AzureComponent
  | K8sComponent
  | OssComponent
  | ApiGroupComponent
  | EndpointComponent
  | UnknownComponent
  | DbTableComponent
  | JsonViewerComponent
  | SvgComponent
  | ProcessNodeComponent
  | ExternalElementComponent
  | PluginTypedComponent;

export type ComponentPatch = Partial<Omit<C4Component, "id">> &
  Partial<Omit<PanelComponent, "id">> &
  Partial<Omit<NoteComponent, "id">> &
  Partial<Omit<AwsComponent, "id">> &
  Partial<Omit<GcpComponent, "id">> &
  Partial<Omit<AzureComponent, "id">> &
  Partial<Omit<K8sComponent, "id">> &
  Partial<Omit<OssComponent, "id">> &
  Partial<Omit<ApiGroupComponent, "id">> &
  Partial<Omit<EndpointComponent, "id">> &
  Partial<Omit<UnknownComponent, "id">> &
  Partial<Omit<DbTableComponent, "id">> &
  Partial<Omit<JsonViewerComponent, "id">> &
  Partial<Omit<SvgComponent, "id">> &
  Partial<Omit<ProcessNodeComponent, "id">> &
  Partial<Omit<ExternalElementComponent, "id">> &
  Partial<Omit<VsmExternalComponent, "id">> &
  Partial<Omit<VsmTimelineComponent, "id">> &
  Partial<Omit<VsmKaizenComponent, "id">> &
  Partial<Omit<VsmPushComponent, "id">> &
  Partial<Omit<VsmSupermarketComponent, "id">> &
  Partial<Omit<VsmInventoryComponent, "id">> &
  Partial<Omit<VsmProcessComponent, "id">> & { width?: number; height?: number };

export type TypedComponentPatch =
  | (Partial<Omit<C4Component, "id">> & { width?: number; height?: number })
  | (Partial<Omit<PanelComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<NoteComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<AwsComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<GcpComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<AzureComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<K8sComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<OssComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ApiGroupComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<EndpointComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<UnknownComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<DbTableComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<JsonViewerComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<SvgComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ProcessNodeComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ProcessNodeComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ExternalElementComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<VsmExternalComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<VsmTimelineComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<VsmKaizenComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<VsmPushComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<VsmSupermarketComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<VsmInventoryComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<VsmProcessComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<PluginTypedComponent, "id">> & { width?: number; height?: number })
  | { width?: number; height?: number };
