import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCollab } from "@/features/collaboration";
import { useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { useNavigate } from "react-router-dom";
import {
  useActiveDiagramId,
  useActiveDiagramVersionState,
  useConnections,
  useDiagramTags,
  useResolvedComponents,
  useResolvedNodeLayouts,
  isTextComponent,
  type DiagramLayoutSettings,
} from "@/features/diagram";
import type { CanvasProps } from "../canvas.types";
import { useCanvasCompareState } from "./useCanvasCompareState";
import { useCanvasFlowState } from "./useCanvasFlowState";
import { useCanvasGraphState } from "./useCanvasGraphState";
import { useCanvasInteraction } from "./useCanvasInteraction";
import { useCanvasStore } from "./useCanvasStore";
import { useCanvasVisualState } from "./useCanvasVisualState";
import { useInteractionMode } from "./useInteractionMode";
import { useAutoLayout, type AutoLayoutRunOptions } from "./useAutoLayout";
import { edgeLabelBox } from "../layout/edgeLabelBox";

export function useCanvasController(canvasProps: CanvasProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [focusTitleTrigger, setFocusTitleTrigger] = useState(0);
  const { diagram, allDiagrams, visibleComponents, visibleConnections, services, flows, actions } =
    useCanvasStore();
  const activeDiagramId = useActiveDiagramId();
  const resolvedComponents = useResolvedComponents();
  const resolvedNodeLayouts = useResolvedNodeLayouts();
  const resolvedConnections = useConnections();
  const diagramVersionState = useActiveDiagramVersionState();
  const allDiagramTags = useDiagramTags();
  const visualState = useCanvasVisualState(diagram?.id ?? null);
  const { updateSelectedNode } = useCollab();
  const compareState = useCanvasCompareState({
    diagram,
    isFlowPanelOpen: !!canvasProps.isFlowPanelOpen,
    clearCanvasSelection: visualState.clearCanvasSelection,
    t,
  });
  const resolved = useMemo(
    () =>
      activeDiagramId
        ? {
            components: resolvedComponents,
            nodeLayouts: resolvedNodeLayouts,
            connections: resolvedConnections,
          }
        : null,
    [activeDiagramId, resolvedComponents, resolvedNodeLayouts, resolvedConnections],
  );
  const { runAutoLayout, placeTouched, isRunning: isAutoLayoutRunning } = useAutoLayout();
  /**
   * Arranges the diagram. With `settings`, arranges with those instead of the
   * diagram's and stores them in the same undo step (the Arrange menu).
   */
  const arrange = useCallback(
    async (options: AutoLayoutRunOptions = {}) => {
      if (!diagram) return;
      const measuredNodes = reactFlowInstance.getNodes();
      await runAutoLayout(
        resolvedComponents,
        Object.values(resolvedConnections),
        resolvedNodeLayouts,
        measuredNodes,
        options,
      );
    },
    [
      diagram,
      runAutoLayout,
      resolvedComponents,
      resolvedConnections,
      resolvedNodeLayouts,
      reactFlowInstance,
    ],
  );
  const handleAutoLayout = useCallback(() => void arrange(), [arrange]);
  const handleArrangeWithSettings = useCallback(
    (settings: DiagramLayoutSettings) => void arrange({ settings }),
    [arrange],
  );
  /** Whether the layout reserves room for edge labels, which picks its tuned layer gap. */
  const arrangeLabelled = useMemo(
    () =>
      Object.values(resolvedConnections).some(
        (connection) => edgeLabelBox(connection.label, connection.technology) !== undefined,
      ),
    [resolvedConnections],
  );
  const flowState = useCanvasFlowState({ flows, isCompareMode: compareState.isCompareMode });
  const activeCollabElementId = visualState.selectedEdgeId ?? visualState.selectedNodeId;
  useEffect(() => {
    updateSelectedNode(activeCollabElementId);
  }, [activeCollabElementId, updateSelectedNode]);
  const interaction = useCanvasInteraction({
    canvasProps,
    navigate,
    reactFlowInstance,
    reactFlowWrapperRef,
    visualState,
    diagram,
    allDiagrams,
    actions,
    services,
    compareState,
    flowState,
    showVersions,
    setShowVersions,
    setFocusTitleTrigger,
    onAutoLayout: handleAutoLayout,
  });
  const graphState = useCanvasGraphState({
    diagram,
    resolved,
    diagramVersionState,
    flows,
    // Pass selection/highlight/interaction values directly — no extra useMemo wrappers.
    selectedNodeId: visualState.selectedNodeId,
    selectedNodeIds: visualState.selectedNodeIds,
    highlightedNodeIds: visualState.highlightedNodeIds,
    dragTargetPanelId: interaction.dragTargetPanelId,
    unparentCandidatePanelId: interaction.unparentCandidatePanelId,
    isNodeHiddenByTagFilter: visualState.isNodeHiddenByTagFilter,
    setSelectedEdgeId: visualState.setSelectedEdgeId,
    setSelectedNodeIds: visualState.setSelectedNodeIds,
    setSelectedNodeId: visualState.setSelectedNodeId,
    selectedEdgeId: visualState.selectedEdgeId,
    visibleTags: visualState.visibleTags,
    setNoteInlineEditingId: visualState.setNoteInlineEditingId,
    setJsonViewerInlineEditingId: visualState.setJsonViewerInlineEditingId,
    localNodesRef: interaction.localNodesRef,
    innerOnNodesChange: interaction.innerOnNodesChange,
    visibleComponents,
    visibleConnections,
    services,
    allDiagrams,
    // Direct slices instead of wrapped contexts.
    compareState,
    flowState,
    isViewingCoverage: !!canvasProps.isViewingCoverage,
    onPlayFlow: canvasProps.onPlayFlow,
    handleDrillDown: interaction.handleDrillDown,
    handlePanelCollapseToggle: interaction.handlePanelCollapseToggle,
    navigateToDiagram: interaction.navigateToDiagram,
    actions,
    updateNodeInternals,
    t,
  });
  const interactionMode = useInteractionMode(diagram);

  const selectedNodes = useMemo(
    () => graphState.nodes.filter((node) => visualState.selectedNodeIds.has(node.id)),
    [graphState.nodes, visualState.selectedNodeIds],
  );
  const selectedCount = visualState.selectedNodeIds.size;
  // A lone text is edited on the canvas and styled from its floating bar; the
  // side panel would only offer a type switch and fields it has no use for.
  const selectedComponent = visualState.selectedNodeId
    ? resolvedComponents[visualState.selectedNodeId]
    : undefined;
  const isLoneTextSelected =
    selectedCount <= 1 &&
    !visualState.selectedEdgeId &&
    selectedComponent !== undefined &&
    isTextComponent(selectedComponent);
  // With nothing selected the panel shows the diagram's own properties.
  const showElementPanel =
    !isLoneTextSelected &&
    interactionMode.canEditCanvas &&
    visualState.noteInlineEditingId === null &&
    visualState.jsonViewerInlineEditingId === null;
  return {
    t,
    diagram,
    reactFlowWrapperRef,
    visualState,
    nodes: graphState.nodes,
    edges: graphState.edges,
    onNodesChange: graphState.onNodesChange,
    onNodeDragStop: interaction.onNodeDragStop,
    eventHandlers: interaction.eventHandlers,
    interactionMode,
    isRecording: flowState.isRecording,
    actions,
    showSearch: interaction.showSearch,
    setShowSearch: interaction.setShowSearch,
    showDiagramSidebar: interaction.showDiagramSidebar,
    setShowDiagramSidebar: interaction.setShowDiagramSidebar,
    showCommandPalette: interaction.showCommandPalette,
    setShowCommandPalette: interaction.setShowCommandPalette,
    showVersions,
    setShowVersions,
    handleSelectDiagram: interaction.handleSelectDiagram,
    handleSearchSelect: interaction.handleSearchSelect,
    focusTitleTrigger,
    isPanelOpen: interaction.isPanelOpen,
    selectedNodes,
    selectedCount,
    showElementPanel,
    isCompareMode: compareState.isCompareMode,
    allDiagramTags,
    handleAutoLayout,
    handleArrangeWithSettings,
    arrange,
    placeTouched,
    arrangeLabelled,
    isAutoLayoutRunning,
  };
}
