// ─── Store ────────────────────────────────────────────────────────────────────
export {
  useDiagramStore,
  useServiceActions,
  useDiagramActions,
  useIconActions,
  flushWorkspaceToBrowserStorageNow,
  diagramStoreHydrated,
  saveUserTemplate,
} from "./diagram.store";

export { useIconStore } from "./icon-store";

export type { DiagramStore, DiagramSnapshot, ClipboardEntry } from "./store.types";
export type {
  FlowStoreResult,
  FlowStoreRefusal,
  FlowStoreRefusalCode,
  RecordedStepContent,
} from "./slices/flows.slice";

// ─── Selectors ────────────────────────────────────────────────────────────────
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
  useActiveDiagramVersionState,
  useVisibleConnections,
  useServices,
  readerCatalogFromStore,
  useAllComponents,
  useDiagramTags,
  useAllServices,
  useFlows,
  useIconLibrary,
  useIconById,
  useComponentIcon,
  useEdgeControlPoints,
  useAllUserTemplates,
} from "./selectors";

// ─── Version helpers ────────────────────────────────────────────────────────────
export { resolveActiveVersion } from "./helpers/version-helpers";

// ─── Import safety helpers ────────────────────────────────────────────────────

export type { GeneratedEdgeInput, GeneratedNodeInput } from "./slices/generated-graph.slice";
export type { NewConnectedEdge } from "./slices/components.slice";

// ─── Store constants ──────────────────────────────────────────────────────────
export { VIEWPORT_DEBOUNCE_MS } from "./store.constants";

// ─── Persistence ─────────────────────────────────────────────────────────────
export { PERSIST_KEY, buildPersistStoragePayload } from "./persist.config";

// ─── Storage monitoring ──────────────────────────────────────────────────────
export { useStorageMonitor } from "./useStorageMonitor";
export {
  checkStorageHealth,
  clearNonEssentialStorage,
  shouldSuggestFolderSync,
} from "./storage-monitor";

// ─── Save status ─────────────────────────────────────────────────────────────
export { useSaveStatusStore } from "./saveStatus.store";
