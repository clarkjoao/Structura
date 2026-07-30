// ─── Store ────────────────────────────────────────────────────────────────────
export {
  useDiagramStore,
  useCatalogActions,
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
} from "./diagram.store";

export type { DiagramStore, ClipboardEntry } from "./store.types";

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
} from "./selectors";
export type { ActiveDiagramSceneState } from "./selectors/connection.selectors";

// ─── Scene helpers ────────────────────────────────────────────────────────────
export { resolveActiveScene } from "./slices/scene-helpers";

// ─── Store constants ──────────────────────────────────────────────────────────
export {
  VIEWPORT_DEBOUNCE_MS,
  MAX_HISTORY_STEPS,
  HISTORY_COALESCE_MS,
  UNDO_REDO_COOLDOWN_MS,
} from "./store.constants";

// ─── Persistence ─────────────────────────────────────────────────────────────
export { PERSIST_KEY, buildPersistStoragePayload } from "./persist.config";

// ─── Storage monitoring ──────────────────────────────────────────────────────
export { useStorageMonitor } from "./useStorageMonitor";
export {
  checkStorageHealth,
  measureLocalStorageUsage,
  clearNonEssentialStorage,
  shouldSuggestFolderSync,
} from "./storage-monitor";
export type { FolderSyncStatus } from "./storage-monitor";

// ─── Save status ─────────────────────────────────────────────────────────────
export { useSaveStatusStore } from "./saveStatus.store";
export type { StorageHealthLevel, SaveStatus } from "./saveStatus.store";
