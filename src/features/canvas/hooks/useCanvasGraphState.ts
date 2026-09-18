import { useCallback, useMemo, type MutableRefObject } from "react";
import type { TFunction } from "i18next";
import { useStoreApi, type Node } from "@xyflow/react";
import type { Component } from "@/features/diagram";
import type { DiagramSceneState } from "../nodes/useCanvasNodes";
import type { Flow } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useCanvasEdges } from "../edges/useCanvasEdges";
import { useCanvasConnectionDerivations } from "../edges/useCanvasConnectionDerivations";
import { useCanvasHandleReorder } from "../edges/useCanvasHandleReorder";
import { useCanvasNodes } from "../nodes/useCanvasNodes";
import { resolveNodeDescriptor } from "../nodes/node-types";
import { EMPTY_VIEW_SNAPSHOT, resolveViewSnapshot } from "../core/resolveViewSnapshot";
import { useConnectionInternalsSync } from "./useConnectionInternalsSync";
import { useLocalNodes } from "./useLocalNodes";

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

  const effectiveFlowHighlight = flowState.flowHighlight;

  /*
   * What the canvas shows — the rule the viewer uses too (slice 5 of
   * docs/investigation/divergencia-edicao-visualizacao.md). Keyed on exactly
   * the resolved-snapshot references the store selectors already hand out
   * (`getCachedCanvasSnapshot`), so it is rebuilt when components, layouts or
   * connections change and never on an unrelated store write.
   */
  const resolvedComponentsRef = resolved?.components;
  const resolvedNodeLayoutsRef = resolved?.nodeLayouts;
  const resolvedConnectionsRef = resolved?.connections;
  const view = useMemo(
    () =>
      diagram
        ? resolveViewSnapshot(
            diagram,
            {
              sceneId: diagram.activeSceneId ?? null,
              compareSceneId: diagram.compareSceneId ?? null,
            },
            resolveNodeDescriptor,
          )
        : EMPTY_VIEW_SNAPSHOT,
    // `diagram` is read for its scene ids and cache key only; the snapshot
    // references below are what the view depends on.
    [
      diagram?.id,
      diagram?.activeSceneId,
      diagram?.compareSceneId,
      resolvedComponentsRef,
      resolvedNodeLayoutsRef,
      resolvedConnectionsRef,
    ],
  );

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
    flowBadges: flowState.flowBadges,
    coverage: flowState.coverage,
    isViewingCoverage,
    onPlayFlow,
    onAddEndpointToGroup: handleAddEndpointToGroup,
    isNodeHiddenByTagFilter,
    setNoteInlineEditingId,
    setJsonViewerInlineEditingId,
    updateComponent: actions.updateComponent,
  });

  const lastUndoRedoAt = useDiagramStore((s) => s._lastUndoRedoAt);
  const lastLayoutWriteAt = useDiagramStore((s) => s._lastLayoutWriteAt);

  // `params` is a fresh object literal on every Canvas render, so depending on it
  // rebuilt this callback — and with it `onNodesChange`, which React Flow writes
  // into its store, notifying every node. The three setters it actually uses are
  // stable, so name them instead.
  const { setSelectedEdgeId, setSelectedNodeIds, setSelectedNodeId } = params;
  const onSelectionFromChanges = useCallback(
    (selectedIds: string[]) => {
      // An empty list is a real deselection and must reach the store. It also arrives when React
      // Flow deselects nodes because an edge was clicked, so only reset the edge/menu state when
      // nodes actually got selected.
      if (selectedIds.length > 0) {
        setSelectedEdgeId(null);
      }
      setSelectedNodeIds((prev) => {
        if (prev.size === selectedIds.length && selectedIds.every((id) => prev.has(id))) {
          return prev;
        }
        return new Set(selectedIds);
      });
      setSelectedNodeId(selectedIds[0] ?? null);
    },
    [setSelectedEdgeId, setSelectedNodeIds, setSelectedNodeId],
  );
  const visibleTagsKey = useMemo(
    () => (visibleTags ? [...visibleTags].sort().join("\x00") : null),
    [visibleTags],
  );

  /*
   * A drag frame's only reader is React Flow, and `<ReactFlow nodes>` reaches
   * its store through `setNodes`. Calling it here is that same call without a
   * Canvas render: the controller's hook chain runs on store changes, not once
   * per pointermove. The `nodes` prop catches up on the first render after the
   * gesture -- the drag's last change carries `dragging: false`.
   */
  const reactFlowStore = useStoreApi();
  const publishDragFrame = useCallback(
    (dragged: Node[]) => {
      reactFlowStore.getState().setNodes(dragged);
    },
    [reactFlowStore],
  );

  const { nodes, onNodesChange } = useLocalNodes(
    storeNodes,
    innerOnNodesChange,
    localNodesRef,
    onSelectionFromChanges,
    diagram,
    publishDragFrame,
    lastUndoRedoAt,
    lastLayoutWriteAt,
  );

  const edges = useCanvasEdges({
    diagram,
    view,
    edgeHandleAssignments,
    selectedEdgeId,
    isPlaying: flowState.isPlayingEffective,
    isCompareMode: compareState.isCompareMode,
    compareConnectionOpacity: compareState.compareConnectionOpacity,
    activeStep: flowState.activeStep,
    flowHighlight: effectiveFlowHighlight,
    flowBadges: flowState.flowBadges,
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
