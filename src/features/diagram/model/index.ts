// ─── Enums ───────────────────────────────────────────────────────────────────
export {
  ServiceSource,
  PanelKind,
  EdgeStyle,
  StrokeStyle,
  EdgeMarker,
  ExternalLinkType,
  FileSystemEntryKind,
} from "../enums";

// ─── Component Model ──────────────────────────────────────────────────────────
export { sanitizeComponentType } from "./sanitize-component-type";

export type {
  ComponentType,
  Component,
  ComponentPatch,
  PanelComponent,
  SwimlaneStyle,
  AwsComponent,
  ApiGroupComponent,
  ApiProtocol,
  EndpointComponent,
  UnknownComponent,
  SvgComponent,
  DbTableComponent,
  DbColumn,
  JsonViewerComponent,
  ExternalElementComponent,
  FlowNodeShape,
  NodeFillMode,
  NodeStrokeMode,
  K8sServiceComponent,
  K8sWorkloadComponent,
  K8sWorkloadKind,
  K8sContainerRole,
  ShardStrategy,
  TextComponent,
  EndpointHandler,
  HttpMethod,
} from "./component.types";

// ─── Layout ──────────────────────────────────────────────────────────────────
export type {
  Point,
  NodeLayout,
  ViewNodeLayout,
  EdgeLayout,
  EdgeControlPoint,
  EdgePathType,
} from "./layout.types";

export {
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  SWIMLANE_DEFAULT_W,
  SWIMLANE_DEFAULT_H,
  PANEL_COLLAPSED_W,
  PANEL_COLLAPSED_H,
  NOTE_DEFAULT_W,
  NOTE_DEFAULT_H,
  NOTE_COLLAPSED_W,
  NOTE_COLLAPSED_H,
  DB_TABLE_COLLAPSED_W,
  DB_TABLE_COLLAPSED_H,
  MIN_HANDLES,
  MAX_HANDLES,
  NODE_DRAG_PADDING,
  panelTopInset,
  DEFAULT_NODE_W,
  DEFAULT_NODE_H,
  API_GROUP_HEADER_H,
  API_GROUP_ENDPOINT_H,
  API_GROUP_FOOTER_H,
  API_GROUP_FRAME_W,
} from "./layout.constants";
export { TEXT_SIZES, TEXT_COLORS, DEFAULT_TEXT_SIZE, DEFAULT_TEXT_COLOR } from "./text-style";
export type { TextSize, TextColor } from "./text-style";

// ─── Boundary ─────────────────────────────────────────────────────────────────
export { BOUNDARY_TYPES } from "./boundary-type";
export type { BoundaryType } from "./boundary-type";
export { domainColor, elementDomain, resolveBoundaryAppearance } from "./boundary";

// ─── Connection ───────────────────────────────────────────────────────────────
export type {
  Connection,
  ConnectionStyle,
  ConnectionInteraction,
  ConnectionKind,
  ConnectionDirection,
} from "./connection.types";

export { resolveConnectionSemantics, getEffectiveConnectionStyle } from "./connection-defaults";

// ─── Flow ─────────────────────────────────────────────────────────────────────
export type {
  FlowStep,
  FlowStepType,
  FlowStepContext,
  FlowConditionKind,
  FlowBranch,
  Flow,
} from "./flow.types";

// ─── Diagram / Version / Template / Service ────────────────────────────────────
// diagram.types owns Level, Icon*, ModelDraft, Diagram, VersionDiff, Folder, etc.
export type {
  Diagram,
  DiagramModel,
  VersionDiff,
  VersionStatus,
  UserTemplate,
  UserTemplateComponent,
  ExternalLink,
  IconDefinition,
  Folder,
  Level,
  DiagramDirection,
} from "./diagram.types";

export { isAwsIcon, isLucideIcon, isSvgIcon, VERSION_STATUSES } from "./diagram.types";

export type { DiagramLayoutSettings } from "./layout-settings";

export type { ServiceDefinition, ServiceSourceRef } from "./service.types";
export {
  SERVICE_ROLES,
  effectiveServiceRole,
  isServiceRole,
  suggestServiceRole,
} from "./service-role";
export type { ServiceRole } from "./service-role";
export type { ServiceManifestEntry } from "./service-manifest.types";

// ─── Component type constants ──────────────────────────────────────────────────
export {
  COMPONENT_TYPE_UNKNOWN,
  COMPONENT_TYPE_SVG,
  COMPONENT_TYPE_DB_TABLE,
  COMPONENT_TYPE_JSON_VIEWER,
  COMPONENT_TYPE_PROCESS_NODE,
  COMPONENT_TYPE_SHARED_REF,
  COMPONENT_TYPE_TEXT,
  isTextType,
  isPanelType,
  isNoteType,
  isC4Type,
  isPluginComponentType,
  isEndpointType,
  isApiGroupType,
  isJsonViewerType,
  isPersonType,
  isSystemType,
  isContainerType,
  isPanelKind,
  isReactFlowParentPanelType,
  isComponentType,
  getDefaultNameForNewComponent,
} from "./component-type-constants";
export type { C4Type } from "./component-type-constants";

// ─── Component guards ────────────────────────────────────────────────────────
export {
  isPanelComponent,
  isNoteComponent,
  isC4Component,
  isAwsComponent,
  isGcpComponent,
  isAzureComponent,
  isApiGroupComponent,
  isEndpointComponent,
  isDbTableComponent,
  isJsonViewerComponent,
  isProcessNodeComponent,
  isK8sContainerComponent,
  isK8sIngressComponent,
  isK8sServiceComponent,
  isK8sWorkloadComponent,
  isK8sNamespaceComponent,
  isK8sClusterComponent,
  isShardComponent,
  isShardedStoreComponent,
  isTextComponent,
  isPluginTypedComponent,
} from "./component.guards";
