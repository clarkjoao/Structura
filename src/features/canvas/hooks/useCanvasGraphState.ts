import { useCallback, useMemo, type MutableRefObject } from "react";
import type { TFunction } from "i18next";
import type { Node } from "@xyflow/react";
import type { Component } from "@/features/diagram";
import type { DiagramSceneState } from "../nodes/useCanvasNodes";
import type { Flow } from "@/features/diagram";
import { useCanvasEdges } from "../edges/useCanvasEdges";
import { useCanvasConnectionDerivations } from "../edges/useCanvasConnectionDerivations";
import { useCanvasHandleReorder } from "../edges/useCanvasHandleReorder";
import { useCanvasNodes } from "../nodes/useCanvasNodes";
import { useConnectionInternalsSync } from "./useConnectionInternalsSync";
import { useLocalNodes } from "./useLocalNodes";
import { useWalkthroughCanvasHighlight } from "../chat/useWalkthroughCanvasHighlight";
import { useWalkthroughPlayer } from "@/features/walkthroughs";

type FlowSlice = ReturnType<typeof import("./useCanvasFlowState").useCanvasFlowState>;
type CompareSlice = ReturnType<typeof import("./useCanvasCompareState").useCanvasCompareState>;
type DiagramActions = ReturnType<typeof import("@/features/diagram").useDiagramActions>;
type ResolvedSnapshot = import("@/features/diagram").ResolvedSnapshot;
type NodeDragParenting = ReturnType<typeof import("./useNodeDragParenting").useNodeDragParenting>;
type IsNodeHiddenByTagFilter = (c: Component) => boolean;

export interface UseCanvasGraphStateParams {
  diagram:
    | import("@/features/diagram").Diagram
    | import("@/features/diagram").DiagramModel
    | null
    | undefined;
  resolved: ResolvedSnapshot | null;
  diagramSceneState: DiagramSceneState | null;
  flows: Flow[];
  // Selection/highlight values that previously formed nodeSelectionState — passed directly
  // so useCanvasController can drop its useMemo wrappers.
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  isNodeHiddenByTagFilter: IsNodeHiddenByTagFilter;
  // Selection callbacks passed directly.
  setSelectedEdgeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedNodeId: (id: string | null) => void;
  selectedEdgeId: string | null;
  visibleTags: Set<string> | null;
  setNoteInlineEditingId: (id: string | null) => void;
  setJsonViewerInlineEditingId: (id: string | null) => void;
  localNodesRef: MutableRefObject<Node[]>;
  innerOnNodesChange: NodeDragParenting["onNodesChange"];
  visibleComponents: Component[];
  visibleConnections: import("@/features/diagram").Connection[];
  serviceCatalog: Record<string, import("@/features/diagram").ServiceDefinition>;
  allDiagrams: Record<string, import("@/features/diagram").Diagram>;
  // Direct slices instead of wrapped contexts.
  compareState: CompareSlice;
  flowState: FlowSlice;
  isViewingCoverage: boolean;
  onPlayFlow?: (flowId: string) => void;
  handleDrillDown: (elementId: string) => void;
  handlePanelCollapseToggle: (panelId: string) => void;
  navigateToDiagram?: (diagramId: string, nodeId?: string) => void;
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
    selectedEdgeId,
    visibleTags,
    setNoteInlineEditingId,
    setJsonViewerInlineEditingId,
    localNodesRef,
    innerOnNodesChange,
    visibleComponents,
    visibleConnections,
    serviceCatalog,
    allDiagrams,
    compareState,
    flowState,
    isViewingCoverage,
    onPlayFlow,
    handleDrillDown,
    handlePanelCollapseToggle,
    navigateToDiagram,
    actions,
    updateNodeInternals,
    t,
  } = params;

  // Build nodeSelectionState and selectionCallbacks from direct params — avoids extra
  // useMemo wrappers in useCanvasController.
  const nodeSelectionState = {
    selectedNodeId: params.selectedNodeId,
    selectedNodeIds: params.selectedNodeIds,
    highlightedNodeIds: params.highlightedNodeIds,
    dragTargetPanelId: params.dragTargetPanelId,
    unparentCandidatePanelId: params.unparentCandidatePanelId,
    isNodeHiddenByTagFilter: params.isNodeHiddenByTagFilter,
  };

  const {
    selectedNodeId,
    selectedNodeIds,
    highlightedNodeIds,
    dragTargetPanelId,
    unparentCandidatePanelId,
    isNodeHiddenByTagFilter,
  } = nodeSelectionState;

  const journeyPlayer = useWalkthroughPlayer();
  const journeyHighlight = useWalkthroughCanvasHighlight();
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
      resolvedNodeLayouts: resolved?.nodeLayouts ?? {},
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
    serviceCatalog,
    allDiagrams,
    handleDrillDown,
    handlePanelCollapseToggle,
    navigateToDiagram,
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
      // An empty list is a real deselection and must reach the store. It also arrives when React
      // Flow deselects nodes because an edge was clicked, so only reset the edge/menu state when
      // nodes actually got selected.
      if (selectedIds.length > 0) {
        params.setSelectedEdgeId(null);
      }
      params.setSelectedNodeIds((prev) => {
        if (prev.size === selectedIds.length && selectedIds.every((id) => prev.has(id))) {
          return prev;
        }
        return new Set(selectedIds);
      });
      params.setSelectedNodeId(selectedIds[0] ?? null);
    },
    [params],
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
