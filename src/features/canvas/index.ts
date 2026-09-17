export {
  OPACITY_FLOW_PLAYBACK_NODE_DIM,
  FIT_VIEW_DURATION_MS,
  FIT_VIEW_PADDING,
  FIT_VIEW_MAX_ZOOM,
} from "./canvas.constants";
export { default as Canvas } from "./Canvas";
export { default as FlowPanel } from "./flow/FlowPanel";
export { default as FlowReadingRail } from "./flow/reading/FlowReadingRail";
export { default as FlowRecorderPanel } from "./flow/FlowRecorderPanel";
export {
  nodeTypes,
  NODE_TYPE_REGISTRY,
  resolveNodeDescriptor,
  useNodeTypes,
} from "./nodes/node-types";
export type { NodeBuildContext } from "./nodes/node-types";
export { buildCollapsedPanelIds, computeNodeVisibility } from "./nodes/nodeVisibility";
export { buildEdge, filterVisibleConnections, type EdgeBuildParams } from "./edges/data/buildEdges";
export {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
  buildPanelIds,
} from "./edges/connectionDerivations";
export {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowBadges,
  buildFlowHighlight,
  buildCoverage,
} from "./flow/flowState";
export type { FlowBadges, FlowHighlight, CoverageInfo } from "./flow/flowState";
export { sanitizeSvg } from "./utils/svg.sanitizer";
export { FlowModeProvider, useFlowMode, useFlowState } from "./flow";
export type { FlowMode, RecordingContext } from "./flow";
export { FlowScriptList, FlowScriptPanel, useFlowScriptActions, useFlowViewStore } from "./flow";
export { useFlowModePlayback } from "./flow/useFlowModePlayback";
export { useFrameReadStep } from "./flow/reading/useFrameReadStep";
export { useFlowReadingKeys } from "./flow/reading/useFlowReadingKeys";
export { EmbedModal } from "./components/EmbedModal";
export { useInteractionMode } from "./hooks/useInteractionMode";
export type { InteractionMode } from "./hooks/useInteractionMode";
export { AnalysisPanel, useLLMChat } from "./chat";

/** Canvas Core — shared surface for Write / Reader / future Plugin hosts. */
export {
  DiagramSurface,
  DiagramFlowProvider,
  DiagramControls,
  DiagramMiniMap,
  DiagramNodeToolbar,
  DiagramPanel,
  DiagramPosition,
  useDiagramFlow,
  readPolicy,
  writePolicy,
  useReadDiagramFlow,
  projectReadDiagram,
  buildReadNodeContext,
  diagramEdgeTypes,
  DIAGRAM_EDGE_RF_TYPE,
  buildReactFlowShellProps,
  FIT_VIEW_OPTIONS_READ,
  FIT_VIEW_OPTIONS_WRITE,
  PRO_OPTIONS,
} from "./core";
export type {
  DiagramSurfaceProps,
  DiagramSurfacePolicy,
  DiagramSurfaceKind,
  DiagramFlowInstance,
  DiagramNode,
  DiagramNodeComponent,
  DiagramNodeTypes,
  ReadDiagramReading,
  ReadDiagramRoutePlay,
  ReactFlowShellProps,
} from "./core";
export { PendingNodeToolbar } from "./selection-actions/PendingNodeToolbar";

/** Layout engine — public for Reader visualization without deep imports. */
export { fromDiagram, resizableIds } from "./layout/fromDiagram";
export { toAppliedLayouts } from "./layout/applyLayout";
export { layout } from "./layout/layoutEngine";
