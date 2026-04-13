import { useCallback, useMemo, type MutableRefObject } from "react";
import type { TFunction } from "i18next";
import type { Node } from "@xyflow/react";
import type { Component, Connection, Diagram, DiagramModel, ServiceDefinition } from "@/features/diagram";
import type { NodeSelectionState } from "@/features/canvas/hooks/useCanvasVisualState";
import { useCanvasConnectionDerivations } from "../edges/useCanvasConnectionDerivations";
import { useCanvasNodes, type DiagramSceneState } from "../nodes/useCanvasNodes";
import type { Flow } from "@/features/diagram";
import { useCanvasEdges } from "../edges/useCanvasEdges";
import { useCanvasHandleReorder } from "../edges/useCanvasHandleReorder";
import { useLocalNodes } from "./useLocalNodes";
import { useConnectionInternalsSync } from "./useConnectionInternalsSync";
import { useJourneyCanvasHighlight } from "../chat/useJourneyCanvasHighlight";
import { useJourneyPlayer } from "@/features/journeys";

type FlowSlice = ReturnType<typeof import("./useCanvasFlowState").useCanvasFlowState>;
type CompareSlice = ReturnType<typeof import("./useCanvasCompareState").useCanvasCompareState>;
type DiagramActions = ReturnType<typeof import("@/features/diagram").useDiagramActions>;
type ResolvedSnapshot = import("@/features/diagram").ResolvedSnapshot;
type NodeDragParenting = ReturnType<typeof import("./useNodeDragParenting").useNodeDragParenting>;

export interface UseCanvasGraphStateParams {
  diagram: Diagram | DiagramModel | null | undefined;
  resolved: ResolvedSnapshot | null;
  diagramSceneState: DiagramSceneState | null;
  flows: Flow[];
  nodeSelectionState: NodeSelectionState;
  selectionCallbacks: {
    setSelectedEdgeId: (id: string | null) => void;
    setContextMenu: (v: null) => void;
    setSelectedNodeIds: (ids: Set<string>) => void;
    setSelectedNodeId: (id: string | null) => void;
  };
  selectedEdgeId: string | null;
  visibleTags: Set<string> | null;
  setNoteInlineEditingId: (id: string | null) => void;
  setJsonViewerInlineEditingId: (id: string | null) => void;
  localNodesRef: MutableRefObject<Node[]>;
  innerOnNodesChange: NodeDragParenting["onNodesChange"];
  visibleComponents: Component[];
  visibleConnections: Connection[];
  serviceRegistry: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  compareContext: {
    compareState: CompareSlice;
  };
  flowContext: {
    flowState: FlowSlice;
    isViewingCoverage: boolean;
    onPlayFlow?: (flowId: string) => void;
  };
  handleDrillDown: (elementId: string) => void;
  handlePanelCollapseToggle: (panelId: string) => void;
  actions: DiagramActions;
  updateNodeInternals: (nodeIds: string[]) => void;
  t: TFunction;
}


export function useCanvasGraphState(params: UseCanvasGraphStateParams) {
  const {
    diagram,
    resolved,
    diagramSceneState,
    flows,
    nodeSelectionState,
    selectionCallbacks,
    selectedEdgeId,
    visibleTags,
    setNoteInlineEditingId,
    setJsonViewerInlineEditingId,
    localNodesRef,
    innerOnNodesChange,
    visibleComponents,
    visibleConnections,
    serviceRegistry,
    allDiagrams,
    compareContext,
    flowContext,
    handleDrillDown,
    handlePanelCollapseToggle,
    actions,
    updateNodeInternals,
    t,
  } = params;
  const {
    selectedNodeId,
    selectedNodeIds,
    highlightedNodeIds,
    dragTargetPanelId,
    unparentCandidatePanelId,
    isNodeHiddenByTagFilter,
  } = nodeSelectionState;
  const { compareState } = compareContext;
  const { flowState, isViewingCoverage, onPlayFlow } = flowContext;
  // NOTE: `flows` is still forwarded to `useCanvasNodes` because node descriptors consume
  // full flow objects today. Migrating `dataCtx` dependencies to `flowIds` is deferred to
  // a safer follow-up to avoid behavioral regressions in node rendering.

  const journeyPlayer = useJourneyPlayer();
  const journeyHighlight = useJourneyCanvasHighlight();
  const effectiveFlowHighlight = useMemo(() => {
    if (journeyPlayer.mode.kind === "playing") {
      return journeyHighlight;
    }
    return flowState.flowHighlight;
  }, [flowState.flowHighlight, journeyHighlight, journeyPlayer.mode.kind]);

  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({
      visibleComponents,
      visibleConnections,
      resolvedComponents: resolved?.components ?? {},
    });

  const handleAddEndpointToGroup = useCallback(
    (groupId: string) => {
      actions.addComponent("endpoint", t("canvas.newEndpoint"), groupId);
    },
    [actions, t],
  );

  const { onReorderHandle } = useCanvasHandleReorder({
    effectiveHandleOrder,
    updateHandleOrder: actions.updateHandleOrder,
  });

  const storeNodes = useCanvasNodes({
    diagram,
    diagramSceneState,
    flows,
    resolvedComponents: resolved?.components ?? {},
    resolvedNodeLayouts: resolved?.nodeLayouts ?? {},
    sceneBadgeByComponentId: compareState.sceneBadgeByComponentId,
    compareVisualByComponentId: compareState.compareVisualByComponentId,
    isCompareMode: compareState.isCompareMode,
    visibleComponents,
    panelIds,
    selectedNodeId,
    selectedNodeIds,
    highlightedNodeIds,
    serviceRegistry,
    allDiagrams,
    handleDrillDown,
    handlePanelCollapseToggle,
    isPlaying: flowState.isPlayingEffective,
    dragTargetPanelId,
    unparentCandidatePanelId,
    connectionCountPerNode,
    effectiveHandleOrder,
    onReorderHandle,
    flowHighlight: effectiveFlowHighlight,
    activeStep: flowState.activeStep,
    recordingInfo: flowState.recordingInfo,
    coverage: flowState.coverage,
    isViewingCoverage,
    activeFlowId: flowState.activeFlow?.id ?? null,
    onPlayFlow,
    onAddEndpointToGroup: handleAddEndpointToGroup,
    isNodeHiddenByTagFilter,
    setNoteInlineEditingId,
    setJsonViewerInlineEditingId,
    updateComponent: actions.updateComponent,
  });

  
  
  
  const onSelectionFromChanges = useCallback(
    (selectedIds: string[]) => {
      if (selectedIds.length === 0) return;
      selectionCallbacks.setSelectedEdgeId(null);
      selectionCallbacks.setContextMenu(null);
      selectionCallbacks.setSelectedNodeIds(new Set(selectedIds));
      selectionCallbacks.setSelectedNodeId(selectedIds[0] ?? null);
    },
    [selectionCallbacks],
  );
  const visibleTagsKey = useMemo(
    () => (visibleTags ? [...visibleTags].sort().join("\x00") : null),
    [visibleTags],
  );

  const { nodes, onNodesChange } = useLocalNodes(
    storeNodes,
    innerOnNodesChange,
    localNodesRef,
    onSelectionFromChanges,
    diagram,
  );

  const edges = useCanvasEdges({
    diagram,
    visibleConnections,
    edgeHandleAssignments,
    selectedEdgeId,
    isPlaying: flowState.isPlayingEffective,
    isCompareMode: compareState.isCompareMode,
    compareConnectionOpacity: compareState.compareConnectionOpacity,
    activeStep: flowState.activeStep,
    flowHighlight: effectiveFlowHighlight,
    recordingInfo: flowState.recordingInfo,
    coverage: flowState.coverage,
    visibleTags,
    visibleTagsKey,
  });

  useConnectionInternalsSync(connectionCountPerNode, updateNodeInternals);

  return {
    nodes,
    edges,
    onNodesChange,
    effectiveHandleOrder,
    panelIds,
    edgeHandleAssignments,
  };
}
