export {
  ServiceSource,
  ImportPanel,
  PanelKind,
  EdgeStyle,
  StrokeStyle,
  EdgeMarker,
  ExternalLinkType,
  FileSystemEntryKind,
} from "./enums";

export type {
  ComponentType,
  PluginComponentType,
  PluginTypedComponent,
  Level,
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
  Connection,
  ConnectionStyle,
  ConnectionIntent,
  ConnectionDirection,
  NodeLayout,
  ViewNodeLayout,
  Point,
  EdgeLayout,
  EdgeControlPoint,
  EdgePathType,
  FlowStep,
  FlowStepType,
  FlowBranch,
  Flow,
  ModelDraft,
  IconDefinition,
  IconSource,
  Folder,
  Diagram,
  DiagramModel,
  SceneDiff,
  UserTemplate,
  UserTemplateComponent,
  ExternalLink,
} from "./model/diagram.types";

export { isAwsIcon, isLucideIcon, isSvgIcon } from "./model/diagram.types";

export {
  INTENT_DEFAULTS,
  DIRECTION_MARKERS,
  getEffectiveConnectionStyle,
  getIntentDefault,
} from "./model/connection-defaults";
export type { EffectiveConnectionStyle } from "./model/connection-defaults";

export { getLastEdgeStyle, saveLastEdgeStyle } from "./hooks/useLastEdgeStyle";

export { generateId } from "./utils/generate-id";

export {
  formatDiagramImportCalendarDate,
  resolveUniqueDiagramId,
  cloneDiagramForImportWithId,
} from "./utils/shared-import";

export { applyHandleOrder } from "./utils/handle-order";

export { stepsToMermaid, parseMermaidToSteps } from "./utils/flow-mermaid";
export { parseMermaidSequence } from "./utils/import-mermaid-sequence";
export type { MermaidImportPlan } from "./utils/import-mermaid-sequence";
export { parseMermaidFlowchart } from "./utils/import-mermaid-flowchart";
export type { FlowchartImportPlan } from "./utils/import-mermaid-flowchart";

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

export { buildFlowFromRecordingSnapshot } from "./utils/recording-to-flow";
export type { BranchOwnershipMap } from "./utils/recording-to-flow";
export type { BrokenStep } from "./utils/flow-traversal";

export { migrateFlow } from "./utils/flow-migration";

export { repairFlow } from "./utils/flow-repair";

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
export type {
  CompareSnapshotResult,
  CompareElementVisual,
  MergePreview,
} from "./utils/scene.utils";
export { buildChildrenIndex, getDescendantIdsFromIndex } from "./utils/children-index";

export { resolveActiveScene } from "./store/slices/scene-helpers";

export { getCachedCanvasSnapshot } from "./utils/snapshot-cache";
export type { ResolvedSnapshot } from "./utils/snapshot-cache";
export { isAncestorLocked } from "./utils/component-lock";

export {
  readRecentRefs,
  writeRecentRefs,
  removeRecentRef,
  appendRecentRef,
} from "./utils/recent-diagrams";
export type { RecentDiagramRef } from "./utils/recent-diagrams";

export { computeApiGroupSize } from "./utils/api-group-size";

export { computeFitBounds } from "./utils/fit-group-to-children";

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
} from "./model/layout.constants";

export {
  VIEWPORT_DEBOUNCE_MS,
  MAX_HISTORY_STEPS,
  HISTORY_COALESCE_MS,
  UNDO_REDO_COOLDOWN_MS,
} from "./store/store.constants";

export {
  PERSIST_KEY,
  PERSIST_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION,
  buildPersistStoragePayload,
  partializeState,
} from "./store/persist.config";
export type { PersistedDiagramStoreSlice } from "./store/persist.config";

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
} from "./model/component.guards";

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
  COMPONENT_TYPE_PROCESSOS,
  COMPONENT_TYPE_PROCESS_NODE,
  COMPONENT_TYPE_EXTERNAL_ELEMENT,
  isExternalElementType,
  isPanelType,
  isNoteType,
  isC4Type,
  isUnknownType,
  isPluginComponentType,
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
} from "./model/component-type-constants";
export type { C4Type } from "./model/component-type-constants";

export {
  useDiagramStore,
  useCatalogActions,
  useRegistryActions,
  createDiagramStore,
  useDiagramActions,
  useComponentActions,
  useConnectionActions,
  useLayoutActions,
  useSceneActions,
  useFlowActions,
  useHistoryActions,
  useClipboardActions,
  useIconActions,
  flushDiagramStoreToLocalStorageNow,
  updateDiagramDescription,
  saveUserTemplate,
  updateUserTemplate,
  deleteUserTemplate,
} from "./store/diagram.store";

export {
  useDiagrams,
  useAllDiagrams,
  useFolders,
  useAllFolders,
  useActiveDiagramId,
  useActiveDiagram,
  useActiveDiagramModel,
  useComponents,
  useComponent,
  useConnection,
  useConnections,
  useVisibleComponents,
  useResolvedComponents,
  useResolvedNodeLayouts,
  useActiveDiagramSceneState,
  useVisibleConnections,
  useServiceRegistry,
  useServiceCatalog,
  useAllComponents,
  useDiagramTags,
  useAllServices,
  useFlows,
  useIconLibrary,
  useIconById,
  useComponentIcon,
  useEdgeControlPoints,
  useEdgeLabelOffset,
  useAllUserTemplates,
} from "./store/selectors";
export type { ActiveDiagramSceneState } from "./store/selectors/connection.selectors";
export type { DiagramStore, ClipboardEntry } from "./store/store.types";

export { useStorageMonitor } from "./store/useStorageMonitor";
export {
  checkStorageHealth,
  measureLocalStorageUsage,
  clearNonEssentialStorage,
  shouldSuggestFolderSync,
} from "./store/storage-monitor";
export type { FolderSyncStatus } from "./store/storage-monitor";
export { useSaveStatusStore } from "./store/saveStatus.store";
export type { StorageHealthLevel, SaveStatus } from "./store/saveStatus.store";

export {
  exportTemplateToJson,
  downloadTemplate,
  importTemplateFromFile,
} from "./utils/template-sharing";
export type { TemplateExportEnvelope, ImportTemplateResult } from "./utils/template-sharing";
export type { ServiceDefinition, ServiceSourceRef } from "./model/service.types";
