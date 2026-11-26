export { default as Canvas } from "./Canvas";
export { default as FlowPanel } from "./flow/FlowPanel";
export { default as FlowReadingRail } from "./flow/reading/FlowReadingRail";
export { default as FlowRecorderPanel } from "./flow/FlowRecorderPanel";
export { NODE_TYPE_REGISTRY, resolveNodeDescriptor, useNodeTypes } from "./nodes/node-types";
export type { NodeBuildContext } from "./nodes/node-types";

export {
  EMPTY_FLOW_HIGHLIGHT,
  buildFlowBadges,
  buildFlowHighlight,
  buildCoverage,
} from "./flow/flowState";
export type { FlowBadges, FlowHighlight, CoverageInfo } from "./flow/flowState";

export { FlowModeProvider, useFlowMode, useFlowState } from "./flow";
export type { FlowMode, RecordingContext } from "./flow";
export { FlowScriptList, FlowScriptPanel, useFlowScriptActions, useFlowViewStore } from "./flow";
export { useFlowModePlayback } from "./flow/useFlowModePlayback";
export { useFrameReadStep } from "./flow/reading/useFrameReadStep";
export { useFlowReadingKeys } from "./flow/reading/useFlowReadingKeys";
export { EmbedModal } from "./components/EmbedModal";
export { DiagramTitle } from "./toolbar/components/DiagramTitle";
export { InspectorRailToggle } from "./panels/ElementPanel/shell";
export { useInteractionMode } from "./hooks/useInteractionMode";

/** Canvas Core — shared surface for Write / Reader / future Plugin hosts. */
export { DiagramFlowProvider, useDiagramFlow } from "./core";
export type { DiagramFlowInstance, DiagramNode } from "./core";

/** Layout engine — public for Reader visualization without deep imports. */
export { fromDiagram, resizableIds } from "./layout/fromDiagram";
export { toAppliedLayouts } from "./layout/applyLayout";
export { layout } from "./layout/layoutEngine";
