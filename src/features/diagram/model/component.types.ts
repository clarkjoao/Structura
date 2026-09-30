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
  | "flow-divider"
  | SharedComponentType
  | K8sStructureType
  | DeployComponentType
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

  /**
   * How the edges into it are drawn when many things use it. Absent means
   * `edges`, drawn as they are; the edges stay in the model in every mode.
   */
  shared?: SharedSpec;
}

/** How a shared element's incoming edges are drawn: as they are, as badges, via references, or a bus. */
export type SharedMode = "edges" | "badge" | "ref" | "bus";

export interface SharedSpec {
  mode: SharedMode;
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

/** The three colour parts, for elements that wear the flow skin (flow, deploy, k8s). */
export interface SkinParts {
  /** Accent; absent means the element's default, resolved at render. */
  customColor?: string;
  /** Absent means `"none"`. */
  fill?: NodeFillMode;
  /** Absent means `"solid"`. */
  stroke?: NodeStrokeMode;
}

/**
 * A named line across a diagram — a service blueprint's line of interaction,
 * of visibility, of internal interaction. Its label is the name; it stands on
 * its own, not tied to any lane.
 */
export interface FlowDividerComponent extends BaseComponent {
  type: "flow-divider";
  /** Absent means solid. */
  stroke?: NodeStrokeMode;
}

/** The deployment vocabulary (the `deploy` family): stores and their shards. */
export type DeployComponentType = "deploy-sharded-store" | "deploy-shard" | "deploy-shard-router";

/** Kubernetes as structure (the `k8s` family's own elements, beside its catalog cards). */
export type K8sStructureType =
  | "k8s-cluster"
  | "k8s-namespace"
  | "k8s-workload"
  | "k8s-service"
  | "k8s-ingress"
  | "k8s-container";

/** A reference to a shared element, drawn where its consumers are (`shared-ref`). */
export type SharedComponentType = "shared-ref";

/** How a sharded store spreads its keys. Absent means hash. */
export type ShardStrategy = "hash" | "consistent-hash" | "range" | "geo" | "directory";

/**
 * A sharded data store: a typed container whose children are its shards and,
 * optionally, the router in front of them. The number of shards is never
 * stored — it is the number of shard children.
 */
export interface ShardedStoreComponent extends BaseComponent, SkinParts {
  type: "deploy-sharded-store";
  strategy?: ShardStrategy;
  /** "hash(customer_id)". */
  keyExpression?: string;
  /** "MongoDB 7". */
  technology?: string;
  /** Copies of each shard, primary included. Absent means 1. */
  replicationFactor?: number;
  /** Drawn compact. Absent means expanded; never written as false. */
  collapsed?: boolean;
}

/** One shard of a sharded store. Its replicas come from the store's replication factor. */
export interface ShardComponent extends BaseComponent, SkinParts {
  type: "deploy-shard";
  /** What it holds, as the chip and key-bar label say it: "0–25%", "BR", "A–F". */
  keyRange?: string;
  /** Relative width of its range under a range strategy. Absent means 1. */
  share?: number;
  region?: string;
  /** Takes more than its share: painted amber, on the key bar too. */
  hot?: boolean;
}

/** The router in front of a store's shards (mongos, Vitess vtgate): 0 or 1 per store. */
export interface ShardRouterComponent extends BaseComponent, SkinParts {
  type: "deploy-shard-router";
}

/** A Kubernetes cluster: the outermost typed container of a deployment. */
export interface K8sClusterComponent extends BaseComponent, SkinParts {
  type: "k8s-cluster";
  /** "EKS", "GKE", "k3s". */
  distribution?: string;
  /** "1.30". */
  version?: string;
  nodeCount?: number;
  zoneCount?: number;
  collapsed?: boolean;
}

/** A namespace inside a cluster: a logical grouping, drawn dashed. */
export interface K8sNamespaceComponent extends BaseComponent, SkinParts {
  type: "k8s-namespace";
  /** Sidecars injected by the mesh into every pod here. Absent means no. */
  meshInjection?: boolean;
  collapsed?: boolean;
}

/** What a workload is. Absent means Deployment. */
export type K8sWorkloadKind =
  "Deployment" | "StatefulSet" | "DaemonSet" | "Job" | "CronJob" | "Pod";

/** A workload: its pods are drawn from its data (replica tiles), not as nodes. */
export interface K8sWorkloadComponent extends BaseComponent, SkinParts {
  type: "k8s-workload";
  kind?: K8sWorkloadKind;
  /** Desired replicas. Absent means 1. */
  replicas?: number;
  hpaMin?: number;
  hpaMax?: number;
  image?: string;
  /** "250m / 512Mi". */
  resources?: string;
  /** Zones the pods spread over, as labels: ["1a", "1b"]. */
  zones?: string[];
  /** CronJob schedule, in cron syntax. */
  schedule?: string;
  concurrencyPolicy?: "Allow" | "Forbid" | "Replace";
  /** Drawn as one card with its sidecars as tabs. Absent means expanded. */
  collapsed?: boolean;
}

/** A Service in front of a workload's pods. */
export interface K8sServiceComponent extends BaseComponent, SkinParts {
  type: "k8s-service";
  /** Absent means ClusterIP. */
  serviceType?: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
  port?: number;
}

/** An Ingress: the host and class traffic comes in by. */
export interface K8sIngressComponent extends BaseComponent, SkinParts {
  type: "k8s-ingress";
  host?: string;
  ingressClass?: string;
}

/** What a container does in its pod. Absent means main. */
export type K8sContainerRole = "main" | "sidecar" | "init";

/**
 * A container of a workload's pod template: the main one, a sidecar beside
 * it, or an init container run before both, in order.
 */
export interface K8sContainerComponent extends BaseComponent, SkinParts {
  type: "k8s-container";
  podRole?: K8sContainerRole;
  /** A sidecar's function, free text: "proxy", "logs", "secrets", "metrics"… */
  purpose?: string;
  /** An init container's place in the sequence, from 1. */
  order?: number;
  image?: string;
  ports?: number[];
  /** "100m / 128Mi". */
  resources?: string;
}

/**
 * A reference to a shared element: no data of its own, drawn near its
 * consumers. Edges to it are read as edges to the element (`resolveShared`).
 */
export interface SharedRefComponent extends BaseComponent {
  type: "shared-ref";
  refOf: string;
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
  | SharedRefComponent
  | K8sContainerComponent
  | K8sIngressComponent
  | K8sServiceComponent
  | K8sWorkloadComponent
  | K8sNamespaceComponent
  | K8sClusterComponent
  | ShardRouterComponent
  | ShardComponent
  | ShardedStoreComponent
  | FlowDividerComponent
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
  Partial<Omit<SharedRefComponent, "id">> &
  Partial<Omit<K8sContainerComponent, "id">> &
  Partial<Omit<K8sIngressComponent, "id">> &
  Partial<Omit<K8sServiceComponent, "id">> &
  Partial<Omit<K8sWorkloadComponent, "id">> &
  Partial<Omit<K8sNamespaceComponent, "id">> &
  Partial<Omit<K8sClusterComponent, "id">> &
  Partial<Omit<ShardRouterComponent, "id">> &
  Partial<Omit<ShardComponent, "id">> &
  Partial<Omit<ShardedStoreComponent, "id">> &
  Partial<Omit<FlowDividerComponent, "id">> & { width?: number; height?: number };

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
  | (Partial<Omit<SharedRefComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<K8sContainerComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<K8sIngressComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<K8sServiceComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<K8sWorkloadComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<K8sNamespaceComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<K8sClusterComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ShardRouterComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ShardComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<ShardedStoreComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<FlowDividerComponent, "id">> & { width?: number; height?: number })
  | (Partial<Omit<PluginTypedComponent, "id">> & { width?: number; height?: number })
  | { width?: number; height?: number };
