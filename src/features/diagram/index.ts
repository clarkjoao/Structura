/** Enums for diagram domain (ServiceSource, ImportPanel, etc.) */
export {
  ServiceSource,
  ImportPanel,
  PanelKind,
  EdgeStyle,
  StrokeStyle,
  EdgeMarker,
  ExternalLinkType,
} from "./enums";

/** All core domain types (Component, Connection, Flow, Diagram, etc.) */
export type {
  ComponentType,
  Level,
  Component,
  ComponentPatch,
  C4Component,
  PanelComponent,
  SwimlaneStyle,
  NoteComponent,
  AwsComponent,
  ApiGroupComponent,
  ApiProtocol,
  EndpointComponent,
  EndpointHandler,
  HttpMethod,
  Connection,
  ConnectionStyle,
  ConnectionIntent,
  ConnectionDirection,
  NodeLayout,
  ViewNodeLayout,
  Point,
  EdgeLayout,
  FlowStep,
  FlowStepType,
  FlowBranch,
  Flow,
  ModelDraft,
  IconDefinition,
  IconSource,
  Folder,
  Diagram,
  SceneDiff,
  UserTemplate,
  UserTemplateComponent,
  ExternalLink,
} from "./model/diagram.types";

export { isAwsIcon, isLucideIcon, isSvgIcon } from "./model/diagram.types";

/** Default styles and helpers for connection intent/direction resolution */
export {
  INTENT_DEFAULTS,
  DIRECTION_MARKERS,
  getEffectiveConnectionStyle,
  getIntentDefault,
} from "./model/connection-defaults";
export type { EffectiveConnectionStyle } from "./model/connection-defaults";

/** Unique ID generator for diagram entities */
export { generateId } from "./utils/generate-id";

/** Shared preview → workspace import (id collision, flow diagramId) */
export {
  formatDiagramImportCalendarDate,
  resolveUniqueDiagramId,
  cloneDiagramForImportWithId,
} from "./utils/shared-import";

/** Sort connections array by an explicit handle-order array of connection ids */
export { applyHandleOrder } from "./utils/handle-order";

/** Convert Flow graph ↔ Mermaid sequence diagram text */
export { stepsToMermaid, parseMermaidToSteps } from "./utils/flow-mermaid";

/** Flow graph traversal utilities */
export {
  getStepById,
  getNextSteps,
  isConditionStep,
  getEntryStep,
  walkFlow,
  getFlowParticipants,
  validateFlowGraph,
  getOrderedStepIds,
  getStepCount,
  getBranchStepCount,
} from "./utils/flow-traversal";

/** Build a Flow graph from in-progress recording data (same linking as finalize). */
export { buildFlowFromRecordingSnapshot } from "./utils/recording-to-flow";
export type { BranchOwnershipMap } from "./utils/recording-to-flow";
export type { BrokenStep } from "./utils/flow-traversal";

/** Flow migration from legacy array format */
export { migrateFlow } from "./utils/flow-migration";

/** Repair a flow by removing broken steps and cleaning up references */
export { repairFlow } from "./utils/flow-repair";

/** Build a pure-data patch for duplicating a flow */
export { buildFlowDuplicatePatch } from "./utils/flow-duplicate";

export {
  resolveSceneSnapshot,
  resolveCanvasSnapshot,
  resolveCompareSnapshot,
  diagramWithResolvedScene,
  exportFilenameSlug,
  canMoveNodeInSceneMode,
  isComponentAddedInActiveScene,
  isDiagramCompareMode,
  buildCompareComponentVisuals,
  buildCompareConnectionVisuals,
  computeMergePreview,
  sceneHasDiff,
} from "./utils/scene.utils";
export type { CompareSnapshotResult, CompareElementVisual, MergePreview } from "./utils/scene.utils";

/** Type guards for the Component discriminated union */
export {
  isPanelComponent,
  isNoteComponent,
  isC4Component,
  isAwsComponent,
  isApiGroupComponent,
  isEndpointComponent,
} from "./model/component.guards";

/** ComponentType / PanelKind constants and type guards */
export {
  C4_TYPES,
  COMPONENT_TYPE_PANEL,
  COMPONENT_TYPE_NOTE,
  COMPONENT_TYPE_API_GROUP,
  COMPONENT_TYPE_ENDPOINT,
  CANVAS_PANEL_NOTE_TYPES,
  CANVAS_API_TYPES,
  PANEL_KIND_VALUES,
  isPanelType,
  isNoteType,
  isC4Type,
  isEndpointType,
  isApiGroupType,
  isSystemType,
  isContainerType,
  isCanvasStructuralType,
  isCanvasApiType,
  isPanelKind,
  isReactFlowParentPanelType,
  getUsageKeyForType,
  getDefaultNameForNewComponent,
} from "./model/component-type-constants";
export type { C4Type } from "./model/component-type-constants";

/** Zustand store — single source of truth for all diagram state */
export {
  useDiagramStore,
  /** Hook returning all mutation actions (add/update/remove/undo/redo/…) */
  useRegistryActions,
  /** Factory used in tests to create a store backed by a custom storage adapter */
  createDiagramStore,
  /** Hook returning all mutation actions (add/update/remove/undo/redo/…) */
  useDiagramActions,
  /** Custom icon library mutations (add/remove/rename/usage counters) */
  useIconActions,
  updateDiagramDescription,
  saveUserTemplate,
  updateUserTemplate,
  deleteUserTemplate,
} from "./store/diagram.store";

export {
  /** Selector: all diagrams keyed by id */
  useDiagrams,
  /** Selector: flat array of all diagrams */
  useAllDiagrams,
  /** Selector: all folders keyed by id */
  useFolders,
  /** Selector: flat array of all folders */
  useAllFolders,
  /** Selector: currently active diagram id */
  useActiveDiagramId,
  /** Selector: currently active Diagram object */
  useActiveDiagram,
  /** Selector: components record of the active diagram */
  useComponents,
  /** Selector: single component by id */
  useComponent,
  /** Selector: connections record of the active diagram */
  useConnections,
  /** Selector: components that have a nodeLayout (visible on canvas) */
  useVisibleComponents,
  /** Selector: connections whose both endpoints are visible */
  useVisibleConnections,
  /** Selector: serviceRegistry of the active diagram */
  useServiceRegistry,
  /** Selector: flat array of all components in the active diagram */
   useAllComponents,
  /** Selector: flat array of all services in the active diagram */
  useAllServices,
  /** Selector: flat array of all connections in the active diagram */
  useFlows,
  /** Custom icons for the active diagram, sorted by usage then name */
  useIconLibrary,
  useIconById,
  useComponentIcon,
  useEdgeWaypoints,
  useEdgeLabelOffset,
  useAllUserTemplates,
} from "./store/selectors";
export type { DiagramStore, ClipboardEntry } from "./store/store.types";
export type { ServiceDefinition } from "./model/service.types";
