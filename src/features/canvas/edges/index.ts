export { default as CustomEdge } from "./CustomEdge";
export type { EdgeData } from "./edgeData.types";
export { EdgeParticle, PARTICLE_DURATION_MS } from "./EdgeParticle";
export type { EdgeParticleProps } from "./EdgeParticle";
export { EdgeLabel } from "./EdgeLabel";
export type { EdgeLabelProps } from "./EdgeLabel";
export { EdgePayloadOverlay } from "./EdgePayloadOverlay";
export type { EdgePayloadOverlayProps } from "./EdgePayloadOverlay";
export { useLabelDrag } from "./useLabelDrag";
export type { UseLabelDragParams, UseLabelDragResult } from "./useLabelDrag";
export {
  clampLabelPosition,
  getClosestLabelPositionOnPath,
  getLabelPointOnPath,
} from "./edgeGeometry";
export { useCanvasEdges } from "./useCanvasEdges";
export { useCanvasConnectionDerivations } from "./useCanvasConnectionDerivations";
export { useCanvasHandleReorder } from "./useCanvasHandleReorder";
export {
  type HandleAssignment,
  type ConnectionCounts,
  buildPanelIds,
  buildConnectionCountPerNode,
  resolveHandleIndex,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
} from "./connectionDerivations";
export {
  type EdgeBuildParams,
  toMarkerType,
  getEdgeOpacity,
  buildEdge,
  filterVisibleConnections,
} from "./edgeBuilding";
