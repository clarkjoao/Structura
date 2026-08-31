// ─── ID generation ───────────────────────────────────────────────────────────
export { generateId } from "./generate-id";

// ─── Edge style persistence ────────────────────────────────────────────────
export { getLastEdgeStyle, saveLastEdgeStyle } from "./edge-style";

// ─── Import / Export ─────────────────────────────────────────────────────────
export {
  formatDiagramImportCalendarDate,
  resolveUniqueDiagramId,
  cloneDiagramForImportWithId,
} from "./shared-import";

export { exportTemplateToJson, downloadTemplate, importTemplateFromFile } from "./template-sharing";
export type { TemplateExportEnvelope, ImportTemplateResult } from "./template-sharing";

// ─── Handle order ────────────────────────────────────────────────────────────
export { applyHandleOrder } from "./handle-order";

// ─── Flow ────────────────────────────────────────────────────────────────────
export { stepsToMermaid, parseMermaidToSteps } from "./flow-mermaid";
export { parseMermaidSequence } from "./import-mermaid-sequence";
export type { MermaidImportPlan } from "./import-mermaid-sequence";
export { parseMermaidFlowchart } from "./import-mermaid-flowchart";
export type { FlowchartImportPlan } from "./import-mermaid-flowchart";

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
} from "./flow-traversal";
export type { BrokenStep } from "./flow-traversal";

export { buildFlowFromRecordingSnapshot } from "./recording-to-flow";
export type { BranchOwnershipMap } from "./recording-to-flow";

export { getFlowOutEdges, getReachableStepIds, checkFlowInvariants } from "./flow-graph";
export type { FlowEdge, FlowInvariantCode, FlowInvariantViolation } from "./flow-graph";

export {
  computeFlowStepLabels,
  getFlowStepLabel,
  compareFlowStepLabels,
  branchLetter,
} from "./flow-labels";
export type { FlowLabelResult, FlowLabelAmbiguity } from "./flow-labels";

export { migrateFlow } from "./flow-migration";
export { repairFlow } from "./flow-repair";
export { buildFlowDuplicatePatch } from "./flow-duplicate";

// ─── Scene ───────────────────────────────────────────────────────────────────
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
} from "./scene.utils";
export type { CompareSnapshotResult, CompareElementVisual, MergePreview } from "./scene.utils";

export { buildChildrenIndex, getDescendantIdsFromIndex } from "./children-index";

// ─── Snapshot cache ──────────────────────────────────────────────────────────
export { getCachedCanvasSnapshot } from "./snapshot-cache";
export type { ResolvedSnapshot } from "./snapshot-cache";

// ─── Component lock ──────────────────────────────────────────────────────────
export { isAncestorLocked } from "./component-lock";

// ─── Recent diagrams ──────────────────────────────────────────────────────────
export {
  readRecentRefs,
  writeRecentRefs,
  removeRecentRef,
  appendRecentRef,
} from "./recent-diagrams";
export type { RecentDiagramRef } from "./recent-diagrams";

// ─── Layout helpers ───────────────────────────────────────────────────────────
export { computeApiGroupSize } from "./api-group-size";
export { computeFitBounds } from "./fit-group-to-children";
