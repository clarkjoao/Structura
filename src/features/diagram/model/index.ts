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
export { sanitizeComponentType, BUILTIN_COMPONENT_TYPES } from "./sanitize-component-type";

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
  DbTableComponent,
  DbColumn,
  JsonViewerComponent,
  FlowNodeComponent,
  ProcessNodeComponent,
  ExternalElementComponent,
  FlowNodeShape,
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
  DEFAULT_NODE_W,
  DEFAULT_NODE_H,
  API_GROUP_HEADER_H,
  API_GROUP_ENDPOINT_H,
  API_GROUP_FOOTER_H,
  API_GROUP_FRAME_W,
} from "./layout.constants";

// ─── Connection ───────────────────────────────────────────────────────────────
export type {
  Connection,
  ConnectionStyle,
  ConnectionIntent,
  ConnectionDirection,
} from "./connection.types";

export {
  INTENT_DEFAULTS,
  DIRECTION_MARKERS,
  getEffectiveConnectionStyle,
  getIntentDefault,
} from "./connection-defaults";
export type { EffectiveConnectionStyle } from "./connection-defaults";

// ─── Flow ─────────────────────────────────────────────────────────────────────
export type { FlowStep, FlowStepType, FlowBranch, Flow } from "./flow.types";

// ─── Diagram / Scene / Template / Service ────────────────────────────────────
// diagram.types owns Level, Icon*, ModelDraft, Diagram, SceneDiff, Folder, etc.
export type {
  Diagram,
  DiagramModel,
  SceneDiff,
  UserTemplate,
  UserTemplateComponent,
  ExternalLink,
  ModelDraft,
  IconDefinition,
  IconSource,
  Folder,
  Level,
} from "./diagram.types";

export { isAwsIcon, isLucideIcon, isSvgIcon } from "./diagram.types";

export type { ServiceDefinition, ServiceSourceRef } from "./service.types";

// ─── Component type constants ──────────────────────────────────────────────────
export {
  C4_TYPES,
  COMPONENT_TYPE_PANEL,
  COMPONENT_TYPE_NOTE,
  COMPONENT_TYPE_API_GROUP,
  COMPONENT_TYPE_ENDPOINT,
  COMPONENT_TYPE_UNKNOWN,
  COMPONENT_TYPE_SVG,
  COMPONENT_TYPE_DB_TABLE,
  COMPONENT_TYPE_JSON_VIEWER,
  COMPONENT_TYPE_FLOW_NODE,
  COMPONENT_TYPE_PROCESS_NODE,
  COMPONENT_TYPE_EXTERNAL_ELEMENT,
  isExternalElementType,
  isPanelType,
  isNoteType,
  isC4Type,
  isUnknownType,
  isPluginComponentType,
  isRegisteredPluginComponentType,
  isSvgComponentType,
  isEndpointType,
  isApiGroupType,
  isDbTableType,
  isJsonViewerType,
  isFlowNodeType,
  isProcessNodeType,
  isPersonType,
  isSystemType,
  isContainerType,
  isPanelKind,
  isReactFlowParentPanelType,
  isComponentType,
  getUsageKeyForType,
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
  isCloudComponent,
  isApiGroupComponent,
  isEndpointComponent,
  isUnknownComponent,
  isSvgComponent,
  isDbTableComponent,
  isJsonViewerComponent,
  isFlowNodeComponent,
  isProcessNodeComponent,
  isExternalElementComponent,
  isPluginTypedComponent,
} from "./component.guards";
